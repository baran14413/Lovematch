import selfsigned from 'selfsigned';
import fs from 'fs';

async function main() {
    const attrs = [{ name: 'commonName', value: '213.142.134.191' }];
    const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });

    fs.writeFileSync('cert.pem', pems.cert);
    fs.writeFileSync('key.pem', pems.private);
    fs.writeFileSync('public.pem', pems.public);

    console.log("Certs generated successfully!");
}
main();
