import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {ignores: ["**/app.js"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
];
