with import <nixpkgs> { };
stdenv.mkDerivation { name = "tronclone"; buildInputs = [ nodejs-14_x yarn python2Full ]; }
