from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/path', methods=['GET'])
def mock_data():
    with open('protocols.txt', 'r') as file:
        content = file.read()
    return content, 200, {'Content-Type': 'application/json'}

if __name__ == '__main__':
    app.run(debug=True, port=3000)
