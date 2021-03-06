'use strict';

require('colors');
require('events').prototype.inspect = () => {return 'EventEmitter {}';};

let grpc = require('grpc');
let fmt = require('util').format;
let repl = require('repl');
let inquirer = require('inquirer');

function createClient(protoFile, directory, address, options) {
  let parsed = grpc.load({
    root: directory,
    file: protoFile
  });

  inquirer.prompt([{
    type: 'list',
    name: 'packageName',
    message: 'What package you want to use?',
    choices: Object.keys(parsed)
  }]).then(function(answers){
    let def = parsed[answers.packageName];
    // Some protos don't have services defined at all
    if (typeof def === 'function') {
      def = parsed;
    }
    if (!def) {
      throw new Error(fmt("Unable to find a package in %s", protoFile));
    }

    inquirer.prompt({
      type: 'list',
      name: 'serviceName',
      message: 'What service you want to use?',
      choices: Object.keys(def).filter(function(propName){ return def[propName].service; })
    }).then(function(answers){
      setupService(answers.serviceName, address, options, def);
    });
  });
}

function setupService(serviceName, address, options, def){
  let service = def[serviceName].service;

  let creds = options.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl();
  let client = new def[serviceName](address, creds);

  printUsage(serviceName, address, service);
  console.log("");

  let replOpts = {
    prompt: getPrompt(serviceName, address),
    ignoreUndefined: true,
    replMode: repl.REPL_MODE_MAGIC
  };
  let rs = repl.start(replOpts);
  rs.context.client = client;
  rs.context.printReply = printReply.bind(null, rs);
  rs.context.pr = printReply.bind(null, rs);
}

function printUsage(serviceName, address, service) {
  console.log("\nConnecting to %s on %s. Available globals:\n", serviceName, address);

  console.log('  ' + 'client'.red + ' - the client connection to %s', serviceName);
  service.children.forEach(child => {
    console.log('    %s (%s, callback) %s %s', (child.name.charAt(0).toLowerCase() + child.name.slice(1)).green,
      child.requestName,
      "returns".gray,
      child.responseName);
  });

  console.log('\n  ' + 'printReply'.red + ' - function to easily print a server reply (alias: %s)', 'pr'.red);
}

function getPrompt(serviceName, address) {
  return serviceName.blue + '@' + address + '> ';
}

function printReply(rs, err, reply) {
  if (err) {
    console.log("Error: ".red, err);
  } else {
    console.log();
    console.log(JSON.stringify(reply, false, '  '));
    rs.displayPrompt();
  }
}


module.exports = createClient;