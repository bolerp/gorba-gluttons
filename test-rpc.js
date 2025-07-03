// A minimal script to test basic network connectivity from Node.js
async function testRpcConnection() {
  const rpcUrl = 'https://rpc.gorbagana.wtf';
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getHealth',
  };

  console.log(`Attempting to fetch from: ${rpcUrl}`);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Response Body:', errorBody);
      return;
    }

    const data = await response.json();
    console.log('SUCCESS! RPC responded:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('CRITICAL: fetch() command failed. This points to a network issue.');
    console.error('Error details:', error);
  }
}

testRpcConnection(); 