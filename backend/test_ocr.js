const axios = require('axios');

async function test() {
  try {
    // We don't need a real image if we just want to see if the pipe works, but let's give a dummy base64
    const res = await axios.post('http://localhost:5000/api/ml/extract-gradesheet', { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' });
    console.log("Success:", res.status, res.data);
  } catch (err) {
    console.log("Error status:", err.response?.status);
    console.log("Error data:", err.response?.data);
  }
}
test();
