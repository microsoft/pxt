# Theme Information

This folder contains shared themes for pxt apps.

# JSON Structure

`id`: Used internally to reference the theme
`name`: Theme name shown to the user
`monacoBaseTheme`: A base vscode theme for the monaco editor. See https://code.visualstudio.com/docs/getstarted/themes. Defaults to "vs".
`overrideFiles`: List of additional css files that should be included for the theme (to allow for theme-specific changes)
`colors`: Values for each of the theme colors.

# Color Variables
With a few exceptions, theme variables generally fall into 4 or 5 variants within broader categories.

The broad categories are:
| Name          | Description | Example Use |
|---------------|-------------|-------------|
| Header        | Basically just the header bar colors. | Header bar |
| Primary       | Used to indicate most important actions. | Download Button |
| Secondary     | Used to indicate secondary actions. | Zoom buttons |
| Tertiary      | Used to indicate additional actions (secondary/tertiary is often arbitrary, based on what looks nice). | Editor tour buttons |
| Target1       | A target-specific set of subtle colors. | Blockly workspace |
| Target2       | Additional target-specific set of subtle colors. | Sim sidebar |
| Target3       | Additional target-specific set of subtle colors. | Toolbox |
| Neutral1      | A target-agnostic set of subtle colors. | Modals body |
| Neutral2      | A target-agnostic set of subtle colors. | Modal footer |
| Neutral3      | A target-agnostic set of subtle colors. | Expanded code cards |

The variants within each category are generally:
1. Foreground (+Hover)
2. Background (+Hover)
3. Stencil (outlines, separators, etc…)

We also have a few outlier variables:
1. Alpha variables for different levels of transparency
2. Link & focus colors
3. Colors variables
    a. Foreground
    b. Background
    c. Alpha10 for highlights, etc
