import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

import {
  PackageManager,
} from './PackageManager.js';

import {
  runCommand,
  runCommandWithJsonOutput,
  runCommandWithOutput,
} from './exec.js';

export class ComposerPackageManager implements PackageManager {

  async listCommands(input: {
    excludeDeps: Array<string>,
    includeDeps: Array<string>,
    manifestFile: string,
  }) {
    const composerJson = JSON.parse(fs.readFileSync(input.manifestFile, 'utf8'));
    const workingDir = path.dirname(input.manifestFile);

    await runCommand(workingDir, [
      'composer',
      'install',
    ]);

    const outdatedDependencies = await runCommandWithJsonOutput(workingDir, [
      'composer',
      'outdated',
      '--direct',
      '--format=json',
    ]);

    const pattern = /^([a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+)\s+([a-zA-Z0-9.]+)\s+requires\s+([a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+)\s+\(([^()]+)\)/;

    const conflictingPackages: Array<string> = [];
    const groups: Record<string, Array<{
      name: string,
      latest: string,
    }>> = {};

    for (let dependency of outdatedDependencies.installed) {
      if (input.includeDeps.length > 0 && input.includeDeps.includes(dependency.name) === false) {
        continue;
      }

      if (input.excludeDeps.includes(dependency.name)) {
        continue;
      }

      const whyNot = await runCommandWithOutput(workingDir, [
        'composer',
        'why-not',
        dependency.name,
        dependency.latest,
      ], {ignoreReturnCode: true});

      const dependencies = [
        {
          name: dependency.name,
          latest: dependency.latest,
        },
      ];

      whyNot.split('\n').forEach((line) => {
        const match = line.match(pattern);

        if (match === null) {
          return;
        }

        if (match[1] === dependency.name) {
          const matchingOutdatedDependency = outdatedDependencies.installed.find((dep: {name: string}) => dep.name === match[3]);

          if (matchingOutdatedDependency !== undefined) {
            dependencies.push({
              name: match[3],
              latest: matchingOutdatedDependency.latest,
            });

            conflictingPackages.push(match[3]);
          }
        }
      });

      groups[dependency.name] = dependencies;
    }

    for (const dependencyName of Object.keys(groups)) {
      if (conflictingPackages.includes(dependencyName)) {
        delete groups[dependencyName];
      }
    }

    return Object.values(groups).map((dependencies) => {
      const args = [
        'composer',
      ];

      let description: string;
      let detailedDescription: string | null = null;

      if (dependencies.length > 1) {
        description = `Update ${dependencies.length} dependencies`;
        detailedDescription = dependencies
          .map((dependency) => `${dependency.name} to ${dependency.latest}`)
          .join('\n');

        args.push('require');

        let isDev = null;

        for (const dependency of dependencies) {
          const versionConstraint = (composerJson['require']?.[dependency.name] ?? composerJson['require-dev']?.[dependency.name]).trim();
          const isDependencyDev = dependency.name in (composerJson['require-dev'] ?? {});

          if (isDev === null) {
            isDev = isDependencyDev;
          } else if (isDev !== isDependencyDev) {
            core.warning(`Grouped --dev + --no-dev dependencies can't be updated automatically`);
            return null;
          }

          if (semver.satisfies(dependency.latest, versionConstraint)) {
            args.push(`${dependency.name}:${versionConstraint}`);
          } else {
            let targetVersionConstraint: string;

            if (versionConstraint.startsWith('~')) {
              const versionConstraintSplit = versionConstraint.split('.');

              if (versionConstraintSplit.length === 3) {
                targetVersionConstraint = `~${dependency.latest}`;
              } else {
                const dependencyLatestSplit = dependency.latest.split('.');

                targetVersionConstraint = `~${dependencyLatestSplit[0]}.${dependencyLatestSplit[1]}`;
              }
            } else {
              targetVersionConstraint = `^${dependency.latest}`;
            }

            args.push(`${dependency.name}:${targetVersionConstraint}`);
          }
        }

        args.push('--update-with-dependencies');

        if (isDev) {
          args.push('--dev');
        }
      } else {
        const dependency = dependencies[0];
        const versionConstraint = (composerJson['require']?.[dependency.name] ?? composerJson['require-dev']?.[dependency.name]).trim();
        const isDependencyDev = dependency.name in (composerJson['require-dev'] ?? {});

        description = `Update ${dependency.name} to ${dependency.latest}`;

        if (semver.satisfies(dependency.latest, versionConstraint)) {
          args.push('update');
          args.push(dependency.name);
          args.push('--with-dependencies');
        } else {
          let targetVersionConstraint: string;

          if (versionConstraint.startsWith('~')) {
            const versionConstraintSplit = versionConstraint.split('.');

            if (versionConstraintSplit.length === 3) {
              targetVersionConstraint = `~${dependency.latest}`;
            } else {
              targetVersionConstraint = `~${versionConstraintSplit[0]}.${versionConstraintSplit[1]}`;
            }
          } else {
            targetVersionConstraint = `^${dependency.latest}`;
          }

          args.push('require');
          args.push(`${dependency.name}:${targetVersionConstraint}`);
          args.push('--update-with-dependencies');

          if (isDependencyDev) {
            args.push('--dev');
          }
        }
      }

      return {
        args,
        cwd: workingDir,
        description,
        detailedDescription,
      };
    });
  }

  async listFiles(input: {
    manifestFile: string,
  }) {
    const workingDir = path.dirname(input.manifestFile);

    return [
      input.manifestFile,
      path.join(workingDir, 'composer.lock'),
    ];
  }

}
