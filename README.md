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

###

### Setup development environment

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
* Follow the instruction to install Yarn (**https://yarnpkg.com/en/docs/install**)

### Install dependencies
```sh
$ yarn install
```

### Building
```sh
# Build all sources
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

## Linting
```sh
# Run linter over the ./packages folder
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
