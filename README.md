# Science Agent Frontend

Science Agent helps researchers use ICICLE services and resources through natural-language requests. This frontend provides the browser interface for uploading data, managing conversations, and following work performed by the remote Science Agent, including ArrayMorph storage and Smart Labeler workflows.

**Tags:** Software, CI4AI

### License

A project license has not yet been specified in this repository. License approval is required before the software release.

## References

- [Science Agent Backend](https://github.com/ICICLE-ai/science-agent-backend)
- [ICICLE](https://icicle.osu.edu/)
- [Smart Labeler](https://github.com/ICICLE-ai/smart_labeler)
- [ArrayMorph](https://github.com/ICICLE-ai/ArrayMorph)

## Acknowledgements

*National Science Foundation (NSF) funded AI institute for Intelligent Cyberinfrastructure with Computational Learning in the Environment (ICICLE) (OAC 2112606)*

---

# Tutorials

## Store an image and request labeling

This walkthrough uses one image, a valid ICICLE account, a working backend and agent pod, and an S3 bucket you can access. Smart Labeler submission also requires access to the configured Tapis storage and compute resources.

1. Open Science Agent from the ICICLE hub. The backend identifies your account from the Tapis cookie; a production user does not need to paste a token.
2. Create a conversation using **New Conversation**, and upload one image.
3. Open **Settings**, find **S3 Credentials**, and save a named credential profile. Supply the endpoint, bucket, region, access key, and secret key, or import a supported credential file. Select the profile you want this request to use.
4. Enter a request such as:

   > Upload this image with ArrayMorph and use Smart Labeler to label it.

5. Start the request and follow the available progress updates. The intended workflow stores the image through ArrayMorph, recovers it, stages it through Tapis, creates a Smart Labeler pipeline, and submits a job.
6. Read the response for completed stages, pipeline and job IDs, and any point where processing stopped. A submitted job is not a finished labeling result.
7. Continue in the same conversation:

   > Check the status of job JOB_ID. Do not submit another job.

   Replace JOB_ID with the actual ID returned by the service.

The expected outcome is a recorded workflow report and, when submission succeeds, a pipeline and job identifier. Availability of finished annotations depends on the external job; do not assume submission means the image has already been labeled.

## Ask for advice or continue previous work

For advice without starting a job, ask:

> Suggest a model strategy for animal images. Explain the recommendation, but do not create a pipeline or submit a job.

For storage only, ask:

> Store this uploaded image with ArrayMorph in my selected S3 bucket. Do not run Smart Labeler.

Reopen a conversation from the conversation list or Gallery to review its messages and continue the work. Deleting a conversation removes its application records, not jobs or objects already created in external services.

---

# How-To Guides

## Configure and start

Set the frontend's `.env`:

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_HOST
```

Use the browser-accessible backend origin without `/api`. For local development, set it empty to use Vite's existing proxy to port 8000. If output files are served separately, set `VITE_STATIC_FILE_BASE_URL` to their base URL. Never put credentials in `VITE_*` variables.

Run using Docker Compose:

```sh
docker compose up -d
```

Compose downloads Node, installs dependencies, builds the frontend, and serves it at `http://localhost:3000`. It does not require a project Dockerfile or a prebuilt project image. Restart after changing frontend environment settings.

For local development instead:

```sh
npm ci
npm run dev
```

The development address is `http://localhost:5173`. When hub cookies are unavailable locally, put `DEV_TAPIS_TOKEN=<your user token>` in the private `.env.development` file. This development-only setting is not used by the production Compose server.

---

# Explanation

## A service-oriented research assistant

The user describes a goal rather than writing API calls or managing a command-line agent. Science Agent connects that request with available ICICLE services. The frontend is the interaction layer; it does not run the agent, hold database credentials, or submit HPC jobs directly.

The backend validates the user, retrieves the conversation and files, and sends request-specific context to a remote agent pod. The agent uses the supplied service instructions and the user's credentials to perform the requested work. Conversations and uploaded files are stored in PostgreSQL.

## Current scope

The integrated labeling workflow currently accepts exactly one image. Model recommendations are advice, not proof that a particular model is deployed or that an image has been analyzed. External service access and job completion must be checked independently.

The S3 Storage page remains visible, but its browsing and deletion API has not been migrated to the current FastAPI backend. Use the conversation workflow for supported storage operations. Older code-execution controls also do not imply support for the original coding-agent workflow.

Production hub integration must make the Tapis cookie available to the backend and support authenticated HTTP and WebSocket requests. Compose alone does not configure this integration or HTTPS.
