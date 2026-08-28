const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/") {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        message: "Voice Dubbing Studio API is running!",
        status: "success"
      })
    );
  } else if (req.url === "/api/health") {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: "healthy",
        service: "Devotion Dubbing Studio Backend"
      })
    );
  } else {
    res.statusCode = 404;
    res.end(
      JSON.stringify({
        error: "Route not found"
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
