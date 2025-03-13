#!/bin/bash

# Set paths
PREVIEWS_DIR="./tgz-previews"
PACKAGES=("packages/retend" "packages/retend-start" "packages/retend-server")

# Create previews directory if it doesn't exist
mkdir -p $PREVIEWS_DIR

# Pack each package and move to previews
for package in "${PACKAGES[@]}"; do
    echo "Packing $package..."
    cd $package
    pnpm pack
    mv *.tgz ../../$PREVIEWS_DIR/
    cd ../../
done

echo "All packages have been packed and moved to $PREVIEWS_DIR"
