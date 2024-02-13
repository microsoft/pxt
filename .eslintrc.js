/*
Generated from:
https://github.com/typescript-eslint/tslint-to-eslint-config

References:
https://code.visualstudio.com/api/advanced-topics/tslint-eslint-migration
https://github.com/typescript-eslint/tslint-to-eslint-config/blob/master/docs/FAQs.md
https://github.com/microsoft/eslint-plugin-sdl
https://github.com/dustinspecker/awesome-eslint#plugins
*/
module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "sourceType": "module"
    },
    "plugins": [
        "eslint-plugin-import",
        "@typescript-eslint",
        "@microsoft/sdl",
        "eslint-plugin-react",
        "jsx-a11y",
    ],
    "extends": [
    ],
    "rules": {
        // Rules enabled by default or migrated via tslint-to-eslint-config
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/member-delimiter-style": [
            "off",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/no-for-in-array": "error",
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unused-expressions": "error",
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/quotes": [
            "off",
            "double"
        ],
        "@typescript-eslint/semi": [
            "off",
            "always"
        ],
        "@typescript-eslint/triple-slash-reference": [
            "error",
            {
                "path": "always",
                "types": "prefer-import",
                "lib": "always"
            }
        ],
        "@typescript-eslint/type-annotation-spacing": "error",
        "constructor-super": "error",
        "eqeqeq": [
            "off",
            "smart"
        ],
        "import/no-internal-modules": "error",
        "import/no-unassigned-import": "error",
        "no-caller": "error",
        "no-cond-assign": "error",
        "no-control-regex": "error",
        "no-duplicate-case": "error",
        "no-eval": "error",
        "no-invalid-regexp": "error",
        "no-octal": "error",
        "no-octal-escape": "error",
        "no-regex-spaces": "error",
        "no-sparse-arrays": "error",
        "no-throw-literal": "error",
        "no-trailing-spaces": [
            "error",
            {
                "ignoreComments": true
            }
        ],
        "no-unsafe-finally": "error",
        "no-unused-labels": "error",
        "no-var": "error",
        "spaced-comment": [
            "off",
            "always",
            {
                "markers": [
                    "/"
                ]
            }
        ],
        "use-isnan": "error",

        // React A11y
        "jsx-a11y/accessible-emoji": "error",
        "jsx-a11y/alt-text": "error",
        "jsx-a11y/aria-activedescendant-has-tabindex": "error",
        "jsx-a11y/aria-props": "error",
        "jsx-a11y/aria-role": "error",
        "jsx-a11y/aria-unsupported-elements": "error",
        "jsx-a11y/autocomplete-valid": "error",
        "jsx-a11y/heading-has-content": "error",
        "jsx-a11y/html-has-lang": "error",
        "jsx-a11y/img-redundant-alt": "error",
        "jsx-a11y/no-access-key": "error",
        "jsx-a11y/no-distracting-elements": "error",
        "jsx-a11y/role-has-required-aria-props": "error",
        "jsx-a11y/role-supports-aria-props": "error",
        "jsx-a11y/scope": "error",
        "jsx-a11y/tabindex-no-positive": "error",

        // Consider enableing these additional accessability rules:
        // "jsx-a11y/anchor-has-content": "error",
        // "jsx-a11y/anchor-is-valid": "error",
        // "jsx-a11y/aria-proptypes": "error",
        // "jsx-a11y/click-events-have-key-events": "error",
        // "jsx-a11y/iframe-has-title": "error",
        // "jsx-a11y/interactive-supports-focus": "error",
        // "jsx-a11y/label-has-associated-control": "error",
        // "jsx-a11y/media-has-caption": "error",
        // "jsx-a11y/mouse-events-have-key-events": "error",
        // "jsx-a11y/no-interactive-element-to-noninteractive-role": "error",
        // "jsx-a11y/no-noninteractive-element-interactions": "error",
        // "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
        // "jsx-a11y/no-noninteractive-tabindex": "error",
        // "jsx-a11y/no-onchange": "error",
        // "jsx-a11y/no-redundant-roles": "error",
        // "jsx-a11y/no-static-element-interactions": "error",
        // "jsx-a11y/no-autofocus": "error",

        // Microsoft SDL
        "@microsoft/sdl/no-inner-html": "error",
        "@microsoft/sdl/react-iframe-missing-sandbox": "error",
        "@typescript-eslint/no-implied-eval": "error",
        "react/no-danger": "error",
        "import/no-unassigned-import": "off",
        "import/no-internal-modules": "off",
    }
};
