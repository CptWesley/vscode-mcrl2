# Visual Studio Code Extension for mCRL2
Extension to allow working with [mCRL2](https://mcrl2.org/) in [Visual Studio Code](https://code.visualstudio.com/).

## Links
[Download](https://marketplace.visualstudio.com/items?itemName=CptWesley.mcrl2)

## Usage
First, install the extension into your VS Code instance and make sure it's enabled.
Make sure the `/bin/` folder of your mCRL2 installation is either available from your `PATH` or configured in the extension settings.
Open the directory that contains your `.mcrl2` files and optionally your properties (in subdirectories).
Use any of the provided run-options at the top right of the editor window, or alternatively, use the keybindings described below.

## Keybindings
- __F4__: Parses the specification.
- __F5__: Shows the LTS Graph.
- __F6__: Simulates the LTS.
- __F7__: Verifies all found properties.