"""
Create the app's Pinecone index (atlus-brain) if it doesn't exist.
Uses vector index with dimension 1536 (OpenAI text-embedding-3-small), cosine metric.
Run from backend: python scripts/ensure_pinecone_index.py
"""
import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
os.chdir(_backend_dir)

from dotenv import load_dotenv
load_dotenv()

def main():
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    if not api_key:
        print("PINECONE_API_KEY not set in .env")
        sys.exit(1)

    from pinecone import Pinecone, ServerlessSpec, CloudProvider, AwsRegion, Metric

    pc = Pinecone(api_key=api_key)
    index_name = os.getenv("PINECONE_INDEX", "atlus-brain")
    existing = [idx["name"] for idx in pc.list_indexes()]
    if index_name in existing:
        print(f"Index '{index_name}' already exists. Nothing to do.")
        return

    print(f"Creating index '{index_name}' (dimension=1536, cosine, serverless)...")
    pc.create_index(
        name=index_name,
        dimension=1536,
        metric=Metric.COSINE,
        spec=ServerlessSpec(
            cloud=CloudProvider.AWS,
            region=AwsRegion.US_EAST_1,
        ),
    )
    print("Done. Index is provisioning; allow a few seconds before upserting.")

if __name__ == "__main__":
    main()
