{ pkgs ? import 
  (fetchTarball 
    https://releases.nixos.org/nixpkgs/nixpkgs-22.05pre340506.5c37ad87222/nixexprs.tar.xz) 
    {} 
}: with pkgs;
  mkShell
    { name = "Wellet";
      packages = [ 
        nodejs-14_x # node-gyp > 14 doesn't work, see:
                    # https://github.com/nodejs/node/issues/38367
        yarn 
        python2Full ];
      shellHook = ''
        echo "[Wellet project development environment sandbox]"
      '';
    }
