module.exports = {
  root: true,
  extends: "@react-native-community",
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  rules: {
    "react-native/no-inline-styles": 0,
    quotes: [2, "double"],
  },
};
