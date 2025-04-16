#!/bin/bash

# Install zip on Debian-based systems
if [ -f /etc/debian_version ]; then
  apt -qq update
  apt -qq -y install zip

  # Install required tools if not installed
  dotnet tool list -g | grep -q Amazon.Lambda.Tools
  if [ $? -ne 0 ]; then
    dotnet tool install -g Amazon.Lambda.Tools
  fi

  # Ensure the global tools path is accessible
  export PATH="$PATH:/root/.dotnet/tools"
fi

dotnet restore
# update the dotnet framework as per your project and ensure the global tools path is accessible
dotnet lambda package --configuration Debug --framework net8.0 --output-package newrelic-serverless-dotnet-example.zip
