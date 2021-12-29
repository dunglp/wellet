with import <nixpkgs> { };
runCommand "dummy" { buildInputs = [ nodejs-14_x yarn python2Full ]; } ""
