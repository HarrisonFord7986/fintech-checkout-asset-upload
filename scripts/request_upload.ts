const response = await fetch("http://localhost:3000/payment-assets/upload-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    paymentId: "pay_4821",
    merchantId: "store_19",
    assetKind: "receipt",
    contentType: "image/png",
    bytes: 245_760,
    riskScore: 18,
  }),
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));

if (!response.ok) process.exitCode = 1;

export {};
