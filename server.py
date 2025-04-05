import http.server
import socketserver
import ssl

# Define server port
PORT = 6969

# Create handler for serving content
handler = http.server.SimpleHTTPRequestHandler

# Create the HTTPS server
httpd = socketserver.TCPServer(("", PORT), handler)

# Add SSL certificate
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain("server.crt", "server.key")
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving HTTPS on port {PORT}")

# Start the server
httpd.serve_forever()