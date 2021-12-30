{ pkgs ? import 
  (fetchTarball 
    https://releases.nixos.org/nixpkgs/nixpkgs-22.05pre340506.5c37ad87222/nixexprs.tar.xz) 
    {} 
}: with pkgs;
  stdenv.mkDerivation 
    { name = "tronclone";
      buildInputs = [ nodejs-14_x yarn python2Full ];
    }
