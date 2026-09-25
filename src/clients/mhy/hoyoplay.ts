import { Wine } from "../../wine";
import { Locale } from "../../locale";
import { Server } from "../../constants";
import { CommonUpdateProgram } from "../../common-update-ui";
import {
  exec,
  log,
  removeFile,
  resolve,
  stats,
} from "../../utils";
import { join } from "path-browserify";

const HOYOPLAY_INSTALLER_URLS = {
  os: "https://download-porter.hoyoverse.com/download-porter/2025/08/22/VYTpXlbWo8_1.9.0.276_1_0_hyp_hoyoverse_prod_202507291751_bQremVwP.exe",
  cn: "https://hyp-pack.mihoyo.com/hyp/06ecb69ae4ebc857/1.8.1.258_1_0_hyp_mihoyo_prod_202507251751_tWpWc4yF.exe",
};

const COMMON_PREFIX_NAMES = [
  "Yaagl OS",
  "Yaagl HSR OS",
  "Yaagl ZZZ OS",
  "Yaagl HI3 GLB",
  "Yaagl CN",
  "Yaagl HSR CN",
  "Yaagl ZZZ CN",
];

const CANDIDATE_RELATIVE_PATHS = [
  join("drive_c", "Program Files", "HoYoPlay", "launcher.exe"),
  join("drive_c", "Program Files (x86)", "HoYoPlay", "launcher.exe"),
  join("drive_c", "Program Files", "HoYoPlay", "HYP.exe"),
  join("drive_c", "Program Files (x86)", "HoYoPlay", "HYP.exe"),
];

export async function findHoyoplayExecutable(currentPrefix: string): Promise<string | null> {
  // 1. Check current wine prefix
  for (const rel of CANDIDATE_RELATIVE_PATHS) {
    const p = join(currentPrefix, rel);
    try {
      await stats(p);
      return p;
    } catch {
      // not found
    }
  }

  // 2. Check sibling Yaagl prefixes in ~/Library/Application Support/
  const appSupportDir = resolve(join(currentPrefix, "..", ".."));
  for (const appName of COMMON_PREFIX_NAMES) {
    for (const rel of CANDIDATE_RELATIVE_PATHS) {
      const p = join(appSupportDir, appName, "wineprefix", rel);
      try {
        await stats(p);
        return p;
      } catch {
        // not found
      }
    }
  }

  return null;
}

export async function* launchHoyoplayProgram({
  wine,
  locale,
  server,
}: {
  wine: Wine;
  locale: Locale;
  server: Server;
}): CommonUpdateProgram {
  yield ["setUndeterminedProgress"];
  yield ["setStateText", "CONFIGURING_ENVIRONMENT"];

  let launcherPath = await findHoyoplayExecutable(wine.prefix);

  if (!launcherPath) {
    const confirmed = await locale.prompt(
      "HOYOPLAY_NOT_FOUND",
      "HOYOPLAY_NOT_FOUND_DESC"
    );
    if (!confirmed) {
      return;
    }

    const isCN = server.id.toLowerCase().includes("cn");
    const installerUrl = isCN
      ? HOYOPLAY_INSTALLER_URLS.cn
      : HOYOPLAY_INSTALLER_URLS.os;

    const installerPath = resolve("./hoyoplay_installer.exe");
    yield ["setStateText", "DOWNLOADING_HOYOPLAY"];
    await log(`Downloading HoYoPlay installer from: ${installerUrl}`);

    try {
      await exec(["curl", "-L", installerUrl, "-o", installerPath]);
    } catch (e) {
      await log(`Failed to download HoYoPlay installer: ${e}`);
      await locale.alert("HOYOPLAY_INSTALL_FAILED", "HOYOPLAY_INSTALL_FAILED_DESC");
      return;
    }

    yield ["setStateText", "INSTALLING_HOYOPLAY"];
    await log("Running HoYoPlay installer in Wine prefix...");
    try {
      await wine.exec2(wine.toWinePath(installerPath), []);
    } catch (e) {
      await log(`Installer execution ended: ${e}`);
    } finally {
      try {
        await removeFile(installerPath);
      } catch {
        // ignore
      }
    }

    await wine.shutdownServer();

    launcherPath = await findHoyoplayExecutable(wine.prefix);
    if (!launcherPath) {
      await locale.alert("HOYOPLAY_INSTALL_FAILED", "HOYOPLAY_INSTALL_FAILED_DESC");
      return;
    }
  }

  yield ["setStateText", "HOYOPLAY_RUNNING"];
  await log(`Launching HoYoPlay: ${launcherPath}`);

  // Sync Yaagl UI language to HoYoPlay registry and CLI
  const hypLang = locale.get("CONTENT_LANG_ID") || "zh-cn";
  for (const company of ["Cognosphere", "miHoYo"]) {
    const regKey = `HKEY_CURRENT_USER\\Software\\${company}\\HYP\\1_0`;
    await wine
      .exec(
        "reg",
        ["add", regKey, "/v", "language", "/t", "REG_SZ", "/d", hypLang, "/f"],
        {},
        "/dev/null"
      )
      .catch(() => {});
  }

  try {
    await wine.exec2(launcherPath, [
      "--in-process-gpu",
      `--lang=${hypLang}`,
    ]);
  } catch (e) {
    await log(`HoYoPlay finished with: ${e}`);
  } finally {
    yield ["setStateText", "CONFIGURING_ENVIRONMENT"];
    await wine.shutdownServer();
  }
}
