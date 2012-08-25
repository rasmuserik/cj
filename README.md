# Compressed JSON

Structure preserving compression of JSON data.

Works in the browser:

    <html><head><title>Compression test</title></head><body><script src="cj.js"></script>
    <script>
        function deepEqual(a,b) { return JSON.stringify(a) === JSON.stringify(b); };
        function compressionTest(data) {
            document.write('<div>JSON length: ' + JSON.stringify(data).length + '</div>');
            document.write('<div>CJ length: ' + cj.encode(data).length + '</div>');
        }
    </script>
    <script src="https://api.github.com/users/mozilla/repos?callback=compressionTest"></script>
    </body></html>
→
    JSON length: 34476
    CJ length: 4876

as well as in node.js

    cj = require('./cj');
    console.log('JSON length:',  JSON.stringify(process.env).length);
    console.log('CJ length:', cj.encode(process.env).length);
→
    JSON length: 4351
    CJ length: 1396

- Data consist of total byte-length as a 32bit integer, followed by value-data followed by value-type.
- Value-type is a reverse variable-byte-coded integer, where the low 3 bits is a type tag
    - Array-type, 
