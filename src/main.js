const vscode = require('vscode');
const cp = require('child_process');

let output = vscode.window.createOutputChannel('mCRL2');

function activate(context) {
	register(context, 'mcrl2.parse', parse);
}

function deactivate() {
	//nothing
}

function register(context, name, func) {
	let disposable = vscode.commands.registerCommand(name, func);
	context.subscriptions.push(disposable);
}

function parse() {
	output.show();
	runMcrl2("mcrl22lps", "-e " + vscode.window.activeTextEditor.document.fileName);
}

function createCommand(cmd) {
	let config = vscode.workspace.getConfiguration('mcrl2');
	var binPath = config.get('binPath').trim();

	if (binPath.length == 0) {
		return cmd.trim();
	}

	if (binPath.length > 0 && binPath[binPath.length - 1] != '/' && binPath[binPath.length - 1] != '\\') {
		binPath += '/';
	}

	return binPath + cmd.trim();
}

function run(cmd) {
	let process = cp.exec(cmd);
	process.stdout.setEncoding('utf8');
	process.stderr.setEncoding('utf8');
	process.stdout.on('data', function(data) {
		output.append(data.toString());
	});
	process.stderr.on('data', function(data) {
		output.append(data.toString());
	});
}

function runMcrl2(cmd, ...args) {
	let argString = args.map(x => x.trim()).join(' ');
	run(createCommand(cmd) + " " + argString);
}

module.exports = {
	activate,
	deactivate
}
