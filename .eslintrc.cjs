const hasJestPlugin = (() => {
  try {
    require.resolve("eslint-plugin-jest");
    return true;
  } catch {
    return false;
  }
})();

const hasVitestPlugin = (() => {
  try {
    require.resolve("eslint-plugin-vitest");
    return true;
  } catch {
    return false;
  }
})();

const antiFalseGreenTestRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "CallExpression[callee.type='MemberExpression'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.property.name=/^(toBe|toEqual|toStrictEqual)$/][callee.object.arguments.length=1][callee.object.arguments.0.value=true][arguments.length=1][arguments.0.value=true]",
      message:
        "Avoid placebo assertions like expect(true).toBe(true); assert real behavior instead.",
    },
    {
      selector:
        "CallExpression[callee.type='MemberExpression'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.property.name=/^(toBe|toEqual|toStrictEqual)$/][callee.object.arguments.length=1][callee.object.arguments.0.value=false][arguments.length=1][arguments.0.value=false]",
      message:
        "Avoid placebo assertions like expect(false).toBe(false); assert real behavior instead.",
    },
    {
      selector:
        "CallExpression[callee.object.callee.name='expect'][callee.property.name='not'][parent.type='MemberExpression']",
      message:
        "Avoid weak negative assertion chains that can mask false-green tests; assert concrete outcomes.",
    },
    {
      selector:
        "AwaitExpression > CallExpression[callee.object.name='page'][callee.property.name='waitForTimeout']",
      message:
        "Avoid hard sleeps in tests; use deterministic waits like expect(...).toBeVisible() or waitForResponse().",
    },
    {
      selector:
        "CallExpression[callee.type='MemberExpression'][callee.property.name='toBeDefined']",
      message:
        "Avoid low-value matcher toBeDefined(); prefer explicit assertions. If absolutely necessary, use `codex-allow-toBeDefined` with guard script justification.",
    },
  ],
  "no-restricted-properties": [
    "error",
    { object: "it", property: "only", message: "Do not commit focused tests (`it.only`)." },
    { object: "test", property: "only", message: "Do not commit focused tests (`test.only`)." },
    { object: "describe", property: "only", message: "Do not commit focused suites (`describe.only`)." },
    { object: "it", property: "skip", message: "Do not commit skipped tests (`it.skip`)." },
    { object: "test", property: "skip", message: "Do not commit skipped tests (`test.skip`)." },
  ],
      ...(hasJestPlugin
    ? {
        "jest/expect-expect": "error",
        "jest/no-commented-out-tests": "error",
        "jest/no-conditional-expect": "error",
        "jest/valid-expect-in-promise": "error",
        "jest/valid-expect": "error",
      }
    : {}),
  ...(hasVitestPlugin
    ? {
        "vitest/expect-expect": "error",
        "vitest/no-commented-out-tests": "error",
        "vitest/no-focused-tests": "error",
        "vitest/no-disabled-tests": "error",
      }
    : {}),
};

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    ...(hasJestPlugin ? ['jest'] : []),
    ...(hasVitestPlugin ? ['vitest'] : []),
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/no-unescaped-entities': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
    },
    {
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'e2e/**/*.ts',
      ],
      rules: antiFalseGreenTestRules,
    },
    {
      files: [
        'src/features/workspaces/components/*Prompt.tsx',
        'src/features/git/components/BranchSwitcherPrompt.tsx',
        'src/features/threads/components/RenameThreadPrompt.tsx',
        'src/features/settings/components/SettingsView.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='role'][value.value='dialog']",
            message:
              'Use `ModalShell` for modal dialog shell markup instead of `<div role="dialog">`.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='aria-modal']",
            message:
              'Use `ModalShell` for modal dialog shell markup instead of manually setting `aria-modal`.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/\\b[a-z0-9-]*modal-(overlay|backdrop|window|card)\\b/]",
            message:
              'Modal shell chrome belongs in `ModalShell`; avoid legacy `*-modal-overlay/backdrop/window/card` wrappers.',
          },
          {
            selector:
              "Literal[value=/#[0-9A-Fa-f]{3,8}|rgba?\\(|hsla?\\(/]",
            message:
              'Avoid hardcoded color literals in DS-targeted components; use design-system CSS variables/tokens.',
          },
        ],
      },
    },
    {
      files: [
        'src/features/git/components/GitDiffPanel.tsx',
        'src/features/files/components/FileTreePanel.tsx',
        'src/features/prompts/components/PromptPanel.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "JSXOpeningElement[name.name='aside']",
            message: 'Use `PanelFrame` instead of raw `<aside>` for DS panel shells.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/\\b(file-tree-meta|prompt-panel-meta|file-tree-search|prompt-panel-search|file-tree-search-icon|prompt-panel-search-icon|file-tree-search-input|prompt-panel-search-input)\\b/]",
            message:
              'Use DS panel sub-primitives (`PanelMeta` / `PanelSearchField`) for meta/search shell markup.',
          },
          {
            selector:
              "Literal[value=/#[0-9A-Fa-f]{3,8}|rgba?\\(|hsla?\\(/]",
            message:
              'Avoid hardcoded color literals in DS-targeted components; use design-system CSS variables/tokens.',
          },
        ],
      },
    },
    {
      files: [
        'src/features/app/components/ApprovalToasts.tsx',
        'src/features/notifications/components/ErrorToasts.tsx',
        'src/features/update/components/UpdateToast.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/^(approval-toasts|error-toasts|update-toasts)$/]",
            message:
              'Use `ToastViewport` for toast region wrappers instead of raw `<div>` wrappers.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/^(approval-toast|error-toast|update-toast)$/]",
            message:
              'Use `ToastCard` for toast cards instead of raw `<div>` wrappers.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/^(approval-toast-header|error-toast-header|update-toast-header|approval-toast-actions|update-toast-actions|update-toast-error)$/]",
            message:
              'Use DS toast sub-primitives (`ToastHeader`, `ToastActions`, `ToastError`) for shared toast structure.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='aria-live']",
            message:
              'Use `ToastViewport` for live-region semantics instead of raw `<div aria-live>` wrappers.',
          },
          {
            selector:
              "Literal[value=/#[0-9A-Fa-f]{3,8}|rgba?\\(|hsla?\\(/]",
            message:
              'Avoid hardcoded color literals in DS-targeted components; use design-system CSS variables/tokens.',
          },
        ],
      },
    },
    {
      files: ['src/features/git/components/GitDiffViewer.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "Literal[value=/#[0-9A-Fa-f]{3,8}|rgba?\\(|hsla?\\(/]",
            message:
              'Avoid hardcoded diff color literals; use DS diff theme variables from `ds-diff.css`.',
          },
        ],
      },
    },
    {
      files: [
        'src/features/app/components/MainHeader.tsx',
        'src/features/app/components/LaunchScriptButton.tsx',
        'src/features/app/components/LaunchScriptEntryButton.tsx',
        'src/features/app/components/OpenAppMenu.tsx',
        'src/features/app/components/Sidebar.tsx',
        'src/features/app/components/SidebarHeader.tsx',
        'src/features/app/components/SidebarCornerActions.tsx',
        'src/features/composer/components/ComposerInput.tsx',
        'src/features/files/components/FilePreviewPopover.tsx',
        'src/features/workspaces/components/WorkspaceHome.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='className'][value.value=/\\b(workspace-add-menu|sidebar-sort-dropdown|sidebar-account-popover|worktree-info-popover|workspace-branch-dropdown|launch-script-popover|open-app-dropdown|file-preview-popover)\\b/]",
            message:
              'Use `PopoverSurface` for popover/dropdown shell markup instead of raw `<div>` wrappers.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='role'][value.value=/^(menu|listbox)$/]",
            message:
              'Use `PopoverSurface` for popover/dropdown shell semantics instead of raw `<div role="menu|listbox">` wrappers.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='button'] > JSXAttribute[name.name='className'][value.value=/\\b(open-app-option|workspace-add-option|sidebar-sort-option)\\b/]",
            message:
              'Use `PopoverMenuItem` for precomputed popover list entries instead of raw `<button>` menu rows.',
          },
          {
            selector:
              "Literal[value=/#[0-9A-Fa-f]{3,8}|rgba?\\(|hsla?\\(/]",
            message:
              'Avoid hardcoded color literals in DS-targeted components; use design-system CSS variables/tokens.',
          },
        ],
      },
    },
  ],
};
