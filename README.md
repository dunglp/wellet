# Wellet  

Wellet is a browser extension implementing wallet functionalities for the
[Welups](https://welups.com) blockchain. It currently supports Chromium/Chrome and
Firefox, but should work with any other browser based on Chromium or Firefox's Quantum
engine.

Main functions:    

Sending and receiving WEL, WRC10 and WRC20 tokens;  
Smart contract calls integrated;    


## Downloads
// Chrome and Firefox links to download on respective store

## Installation

### Development environment setup

#### Using Nix:

* Install [Nix](https://nixos.org/manual/nix/stable/introduction.html):
```sh
$ bash <(curl -L https://nixos.org/nix/install)
```
* Reproduce the build environment:
```sh
$ nix-shell # enter a shell with the build environment for this package
```

#### Manually
* Install [Node.js](https://nodejs.org/en/download)
  * The React version the popup uses depends on a node-sass version that works with Node.js
  14 and would fail to build with Node.js >=16, so make sure to use the right Node.js
  version.
* Follow the instruction to install Yarn (**https://yarnpkg.com/en/docs/install**)

### Installing dependencies
```sh
$ yarn install
```
### Bootstrapping monorepo
```sh
$ yarn lerna bootstrap 
```
If the next build step failed with this, it's a known issue with lerna. More detail
[here](https://stackoverflow.com/a/59529327).

In short:
  * Add `"@tronlink/tronweb": "^0.1.0",` to the `dependencies` property in the
  `package.json` of `packages/backgroundScript`, `packages/lib`, `packages/pageHook` and `packages/popup`
  * run `yarn lerna bootstrap --force-local` (as per the link above's instruction)
More info here: https://github.com/lerna/lerna/issues/2352

### Building
```sh
# Build all sources
$ yarn build:all
```

```sh
# Build everything except the modded Tronweb library
$ yarn build
```

```sh
# Build the backend, along with the injected page script
$ yarn build:core
```

```sh
# Build only the popup component
$ yarn build:popup
```

```sh
# Build only the modded Tronweb library
$ yarn build:tw
```

## Linting
```sh
# Run linter over ./packages
$ yarn lint
```

## Loading into a browser debugging session
### Firefox:
```sh
$ yarn firefox
```
### Chrome/Chromium:
```sh
$ yarn chrome
```
