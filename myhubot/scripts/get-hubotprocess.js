// Description:
//   get processes from the local bot
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   get process <name> - gets a local process on the hubot machine

/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */

const exec = require('child_process').exec;
const AsciiTable = require('ascii-table');
const path = require('path');
const os = require('os');
const fs = require('fs');

const psScriptToInvoke = 'Get-ProcessHubot.ps1';

function getSlackAttachmentMsg(channel, text, attachmentColor, fallback, fields) {
  const msgData = {
    channel,
    text,
    attachments: [{
      color: attachmentColor,
      fallback,
      mrkdwn_in: [
        'fields',
      ],
      fields,
    }],
  };

  return msgData;
}

function createTable(resultOutput, excludedKeys) {
  // parse the json sent from PS
  const resultsParsed = JSON.parse(resultOutput);
  console.log('resultsParsed:');
  console.log(resultsParsed);

  function removeKeys(result) {
    const newRes = result;
    // if the key is in the excludedKeys, delete it
    Object.keys(result).forEach((key) => {
      if (excludedKeys.indexOf(key) !== -1) {
        delete newRes[key];
      }
    });

    return newRes;
  }

  const cleanedResults = resultsParsed.filter(removeKeys);

  console.log('cleanedResults:');
  console.log(cleanedResults);

  const table = new AsciiTable('');

  // construct the heading by getting the keys for the first result
  table.setHeading(Object.keys(resultsParsed[0]));

  // build each row of the table
  cleanedResults.forEach((x) => {
    const tableRows = [];
    Object.keys(x).forEach((key) => {
      tableRows.push(x[key]);
    });
    table.addRow(tableRows);
  });

  // format in backticks
  const formatedTable = `\`\`\`\n${table.toString()}\n\`\`\``;
  console.log(formatedTable);
  return formatedTable;
}

function throwPSError(robot, msg, errorObject) {
  console.log(errorObject);

  // array to store the fields from the error object
  const fieldArray = [];

  // go through each field and add to a hash
  Object.keys(errorObject).forEach((key) => {
    const hash = {};
    const capitalizedKey = key[0].toUpperCase() + key.slice(1);
    hash.title = capitalizedKey;
    hash.value = errorObject[key];
    console.log(`adding ${key} and ${errorObject[key]} to fields`);
    fieldArray.push(hash);
  });

  const textString = `:fire: Error when calling \`${psScriptToInvoke}\``;
  // if computerName
  //  textString += " against machine `#{computerName}`"

  const msgData = getSlackAttachmentMsg(
    msg.message.room,
    textString,
    'danger',
    errorObject,
    fieldArray
  );

  console.log(JSON.stringify(msgData));
  // send the msg
  // robot.adapter.customMessage(msgData);
  msg.send(msgData);
}

module.exports = robot => {
  robot.respond(/get process (.+?) (.*)$/i, msg => {
    const processName = msg.match[1];
    const hostName = msg.match[2];

    console.log(`ProcessName: ${processName}`);
    console.log(`HostName: ${hostName}`);

    // create the PowerShell script to be invoked
    const psScript = `
      . ${path.resolve(__dirname, 'Invoke-HubotPowerShell.ps1')}

      $invokeSplat = @{
        FilePath = '${path.resolve(__dirname, psScriptToInvoke)}'
        Splat = @{ Name = '${processName}' }
        Hostname = '${hostName}'
        UserName = 'vagrant'
        KeyPath = '/myhubot/ssh_keys/my_ssh_key'
      }

      Invoke-HubotPowerShell @invokeSplat
    `;

    // find the temporary path for the script
    const tempPath = path.resolve(os.tmpdir(), 'test.ps1');
    // save the script
    fs.writeFile(tempPath, psScript, (err) => {
      if (err) {
        console.log(err);
        return false;
      }
      console.log(`Saving temporary PowerShell file at: ${tempPath}`);
      return true;
    });

    exec(`powershell -file ${tempPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }

      if (stdout) {
        console.log(`stdout: ${stdout}`);
        // convert the powershell result from json into an ojbect
        const result = JSON.parse(stdout);
        console.log(`result.success ${result.success}`);
        console.log(`result.result_is_json ${result.result_is_json}`);

        if (result.success === true) {
          // Build a string to send back to the channel and
          // include the output (this comes from the JSON output)
          const returnValue = result.result_is_json ? createTable(
            result.output,
            ['RunspaceId', 'PSShowComputerName', 'Handles']) : `\`\`\`${result.output}\`\`\``;
          const textString = `:white_check_mark: Success calling \`${psScriptToInvoke}\``;
          const msgData = getSlackAttachmentMsg(
            msg.message.room,
            textString,
            'good',
            result.output,
            [{
              title: 'Processes',
              value: returnValue,
            }]
          );

          console.log(JSON.stringify(msgData));
          // robot.adapter.customMessage(msgData);
          msg.send(msgData);
        } else {
          console.log('Invoke-HubotPowerShell.ps1 caught an error. Handling it.');
          throwPSError(robot, msg, result.error);
        }
      }

      if (stderr) {
        console.log(`stderr: ${stderr}`);
        const textString = ':fire: Error when calling `Invoke-HubotPowerShell.ps1`';

        const msgData = getSlackAttachmentMsg(
          msg.message.room,
          textString,
          'danger',
          stderr,
          [{
            title: 'Error From Node.js',
            value: `\`\`\`\n${stderr}\n\`\`\``,
          }]
        );

        console.log(JSON.stringify(msgData));

        // robot.adapter.customMessage(msgData);
        msg.send(msgData);
      }
    });
  });
};
