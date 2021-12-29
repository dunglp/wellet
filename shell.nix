with import <nixpkgs> { };
runCommand "dummy" { buildInputs = [ nodejs yarn python2Full ]; } ""
