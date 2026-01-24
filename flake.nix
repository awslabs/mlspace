{
  # mlspace Development Environment Flake
  description = "Development environment for mlspace";

  inputs = {
    # Use the unstable channel for latest package versions
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";

    # Utility functions for creating flakes that work across multiple systems
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    # Generate outputs for all default systems (x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin)
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        # Formatter for this flake (run with `nix fmt`)
        formatter = pkgs.nixpkgs-fmt;

        # Default development shell (enter with `nix develop`)
        devShells.default = pkgs.mkShell {
          # Core development tools needed for mlspace
          packages = with pkgs; [
            awscli2     # AWS command-line interface for deployment and management
            jq          # JSON processor for parsing AWS responses and configuration
            pre-commit  # Git hook framework for code quality checks
            podman
            python311Full     # Python runtime for mlspace backend services
            nodejs      # Node.js runtime for CDK infrastructure and frontend tooling
            nodePackages.aws-cdk # AWS CDK CLI, the command line tool for CDK apps
            uv          # Fast Python package installer and virtual environment manager
            yq          # YAML processor for configuration management
          ];

          # Script that runs when entering the development shell
          shellHook = ''
            echo "Welcome to the mlspace development environment!"
            echo "Python: $(python --version)"
            echo "Node: $(node --version)"
            echo ""

            # Set up Python virtual environment using uv
            if [ ! -d .venv ]; then
              echo "Creating Python virtual environment with uv..."
              uv venv
            else
              echo "Using existing Python virtual environment."
            fi

            # Ensure we start fresh if another venv is active
            if [ -n "$VIRTUAL_ENV" ]; then
              echo "Deactivating existing virtual environment..."
              deactivate
            fi

            # Activate the project virtual environment
            source .venv/bin/activate

            # Install Node.js dependencies
            echo "Installing Node.js dependencies..."
            npm install

            # Configure git hooks for pre-commit
            # Unset any existing hooks path to ensure pre-commit can manage hooks
            git config --unset-all core.hooksPath 2>/dev/null || true
            pre-commit install
          '';
        };
      }
    );
}
