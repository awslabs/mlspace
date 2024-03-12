const getRepoInfo = require('git-repo-info');
const fs = require('fs');
const packageFile = require('../package.json');

const info = getRepoInfo();
console.log("Git Revision Info:");
console.log("Version:", packageFile.version);
console.log("Latest hash:", info.abbreviatedSha);

const revInfo = `window.gitInfo = {
    revisionTag: '${packageFile.version}',
    gitHash: '${info.abbreviatedSha}',
};
`

fs.writeFileSync('./public/git-info.js', revInfo);