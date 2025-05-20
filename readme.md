# Update deps in Github Actions

![Checks](https://github.com/vojtech-dobes/update-deps/actions/workflows/checks.yml/badge.svg?branch=master&event=push)

Opinionated & feature-limited alternative of Renovate for my projects.



## Inputs

### `github_token`

**Required** GitHub token used to commit changes & open Pull Requests.

### `package_manager_type`

**Required** Type of package manager. Supported values are:

- `composer`

### `package_manager_manifest_path`

**Required** Path to manifest file that lists required dependencies (eg. `composer.json`).

### `exclude_deps`

List of dependencies that shouldn't be automatically updated. Expects one dependency per line.

### `include_deps`

If configured, only dependencies in this list will be automatically updated. Expects one dependency per line.



## Example usage

```yaml
- uses: vojtech-dobes/update-deps@v1
  with:
    github_token: ${{ github.token }}
    package_manager_type: composer
    package_manager_manifest_path: ${{ github.workspace }}/composer.json
```
