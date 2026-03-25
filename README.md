# CanvasFlowAI

An MVP exploring how visually designing data analysis pipelines with AI might evolve. Instead of writing code line by line, you describe what you want to learn on a drag-and-drop canvas, refine the plan through conversation, and execute it in one shot.

## How It Works

1. **Plan** -- Ask a question about your dataset. The AI generates a set of analysis steps as nodes on a visual canvas.
2. **Refine** -- Edit nodes, branch new paths, toggle connections, and chat with the AI per-node to sharpen each step.
3. **Run** -- Hit Run. The full graph is serialized into a single prompt, executed, and results render back onto the canvas.

The app ships with the Iris dataset built in so you can start immediately -- no upload required. You can also upload your own CSV or Excel files.

## Privacy

Your API key is stored in your browser's `localStorage` and is sent directly from your browser to the LLM provider. It is **never stored on any server**. The backend is completely stateless -- it receives a request, forwards it to the AI provider, and returns the response. Nothing is persisted server-side.

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js 14, React Flow, Tailwind CSS, Zustand, Anthropic/OpenAI/Google AI SDKs.

## Author

Built by [Justin Tam](https://justinztam.com) -- [more projects](https://projects.justinztam.com)
