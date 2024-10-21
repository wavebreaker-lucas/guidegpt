MataPass Chrome Extension

## Development Setup

This extension uses a template manifest file to protect sensitive information. Follow these steps to set up your development environment:

1. Clone the repository:
git clone https://github.com/wavebreaker-lucas/guidegpt.git
cd guidegpt

2. Create your local manifest file:
- Copy `manifest.template.json` to `manifest.json`:
  ```
  cp manifest.template.json manifest.json
  ```

3. Generate your private key:
- Open a command prompt or terminal
- Run the following command:
  ```
  openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
  ```
- This creates a `key.pem` file in your current directory

4. Extract the public key:
- Run the following command:
  ```
  openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
  ```
- Copy the output (a long string of characters)

5. Update your local manifest:
- Open `manifest.json` in a text editor
- Add a "key" field with your public key:
  ```json
  {
    "manifest_version": 3,
    "name": "Step-by-Step Guide Creator",
    "version": "1.0.01",
    "key": "YOUR_PUBLIC_KEY_HERE",
    // ... other fields
  }
  ```

6. Ensure `key.pem` and `manifest.json` are in your `.gitignore`:
- Open `.gitignore` and add these lines if they're not already present:
  ```
  key.pem
  manifest.json
  ```

7. Load your extension in Chrome:
- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select your extension directory
- You might need to remove your key.pem file.

## Important Notes

- Always use `manifest.json` for local development and testing.
- Only make changes to `manifest.template.json` when you need to update the structure of the manifest for all developers.
- If you update `manifest.template.json`, remember to make the same updates to your local `manifest.json`.
- Never commit `manifest.json` or `key.pem` to the repository.

## Updating the Extension

When making changes to the extension:

1. Update your local `manifest.json` as needed.
2. If the changes should apply to all developers, update `manifest.template.json` accordingly.
3. Commit and push changes to `manifest.template.json` along with other modified files.
4. Other developers should update their local `manifest.json` based on the new template.

## Troubleshooting

If you encounter issues with extension ID consistency:
- Ensure you've added the correct public key to your local `manifest.json`.
- Verify that you're loading the extension from the same directory each time.
- If problems persist, try removing the extension from Chrome and loading it again.

For any other issues or questions, please open an issue in the repository.

