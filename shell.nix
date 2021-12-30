{ pkgs ? import 
  (fetchTarball 
    https://releases.nixos.org/nixpkgs/nixpkgs-22.05pre340506.5c37ad87222/nixexprs.tar.xz) 
    {} 
}: with pkgs;
  mkShell
    { name = "tronclone";
      packages = [ nodejs-14_x yarn python2Full ];
      shellHook = ''
        echo "[tronclone project sandbox]"
      '';
    }
