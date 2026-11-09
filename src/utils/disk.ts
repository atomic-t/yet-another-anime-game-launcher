export async function remountExternalDrives() {
  try {
    await Neutralino.os.execCommand(
      "/usr/sbin/diskutil list external physical 2>/dev/null | grep -Eo 'disk[0-9]+' | sort -u | xargs -I{} /usr/sbin/diskutil mountDisk {} >/dev/null 2>&1",
      {}
    );
  } catch (e) {
    console.warn("Failed to remount external drives", e);
  }
}

export async function ejectExternalDrives() {
  try {
    await Neutralino.os.execCommand(
      "/usr/sbin/diskutil list external physical 2>/dev/null | grep -Eo 'disk[0-9]+' | sort -u | xargs -I{} /usr/sbin/diskutil eject force {} >/dev/null 2>&1",
      {}
    );
  } catch (e) {
    console.warn("Failed to eject external drives", e);
  }
}
