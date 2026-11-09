import { Box, Checkbox, FormControl, FormLabel, Text } from "@hope-ui/solid";
import { createEffect, createSignal } from "solid-js";
import { Locale } from "../locale";
import { Config, NOOP } from "./config-def";
import { assertValueDefined, getKey, setKey } from "@utils";

declare module "./config-def" {
  interface Config {
    autoRemount: boolean;
  }
}

export async function createAutoRemountConfig({
  config,
  locale,
}: {
  config: Partial<Config>;
  locale: Locale;
}) {
  try {
    config.autoRemount = (await getKey("config_autoRemount")) == "true";
  } catch {
    config.autoRemount = false; // default value
  }

  const [value, setValue] = createSignal(config.autoRemount);

  async function onSave(apply: boolean) {
    assertValueDefined(config.autoRemount);
    if (!apply) {
      setValue(config.autoRemount);
      return NOOP;
    }
    if (config.autoRemount == value()) return NOOP;
    config.autoRemount = value();
    await setKey("config_autoRemount", config.autoRemount ? "true" : "false");
    return NOOP;
  }

  createEffect(() => {
    value();
    onSave(true);
  });

  return [
    function UI() {
      return (
        <FormControl id="autoRemount">
          <FormLabel>{locale.get("SETTING_AUTO_REMOUNT")}</FormLabel>
          <Box>
            <Checkbox
              checked={value()}
              size="md"
              onChange={() => setValue(x => !x)}
            >
              {locale.get("SETTING_ENABLED")}
            </Checkbox>
          </Box>
          <Text userSelect={"none"} size="xs" mt="$1">
            {locale.get("SETTING_AUTO_REMOUNT_DESC")}
          </Text>
        </FormControl>
      );
    },
    onSave,
  ] as const;
}
