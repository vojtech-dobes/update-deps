import {
	Command,
} from './Command.js';

export interface PackageManager {

	listCommands(input: {
		excludeDeps: Array<string>,
		includeDeps: Array<string>,
		manifestFile: string,
	}): Promise<Array<Command|null>>,

	listFiles(input: {
		manifestFile: string,
	}): Promise<Array<string>>,

}
