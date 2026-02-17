/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2023: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: "latest",
    project: false, // لو عايز قواعد أعمق فعل tsconfig project هنا
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",

    // لازم ييجي قبل plugin:prettier علشان يلغي التعارضات
    "eslint-config-prettier",

    // بيشغل prettier كقاعدة ESLint ويدي Error لو التنسيق مخالف
    "plugin:prettier/recommended",
  ],
  rules: {
    // خلي prettier هو الحكم في التنسيق
    "prettier/prettier": "error",

    // قواعد مفيدة للـ TS
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": "warn",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: false },
    ],

    // اختياري: شدّة أقل على any
    "@typescript-eslint/no-explicit-any": "off",

    // لراحة الـ Express handlers
    "no-useless-catch": "off",
  },
  ignorePatterns: ["node_modules/", "dist/", "build/", "uploads/", "uploads_tmp/", "coverage/", "*.d.ts"],

  // overrides: [
  //   {
  //     files: ['*.js'],
  //     parser: 'espree',
  //     parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  //   },
  // ],
};
