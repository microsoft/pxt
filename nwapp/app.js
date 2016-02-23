var drivelist = require('drivelist');
var fs = require('fs');

function copyHexFile(name, buf) {
    drivelist.list(function(error, disks) {
            if (error) {
                console.error(error);
                return;
            }
            
            console.output(JSON.stringify(disks));
            disks.forEach(function(disk) {                
                if (/^MICROBIT/.test(disk.description)) {
                }
            })
    });
}