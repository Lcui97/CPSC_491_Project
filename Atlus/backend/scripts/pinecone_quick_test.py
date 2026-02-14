"""
Pinecone Quick Test: create an index (if needed), upsert sample data, run semantic search with reranking.
Run from the backend directory: python scripts/pinecone_quick_test.py
Requires PINECONE_API_KEY in backend/.env
"""
import os
import sys
import time

# Ensure backend root is on path and load .env from backend
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
os.chdir(_backend_dir)

from dotenv import load_dotenv
load_dotenv()

def main():
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    if not api_key:
        print("ERROR: PINECONE_API_KEY not set. Add it to backend/.env")
        sys.exit(1)

    from pinecone import Pinecone
    pc = Pinecone(api_key=api_key)
    index_name = "agentic-quickstart-test"
    namespace = "example-namespace"

    # 1) Ensure index exists (create with integrated embeddings if not)
    existing = [idx["name"] for idx in pc.list_indexes()]
    if index_name not in existing:
        print(f"Creating index '{index_name}' with integrated embeddings...")
        try:
            pc.create_index_for_model(
                name=index_name,
                cloud="aws",
                region="us-east-1",
                embed={
                    "model": "llama-text-embed-v2",
                    "field_map": {"text": "content"},
                },
            )
        except Exception as e:
            print(f"Create index failed: {e}")
            print("Create the index manually: https://app.pinecone.io/")
            print("  Name:", index_name, "| Metric: cosine | Model: llama-text-embed-v2 | field_map: text=content")
            sys.exit(1)
        print("Waiting 5s for index to be ready...")
        time.sleep(5)
    else:
        print(f"Using existing index '{index_name}'.")

    index = pc.Index(index_name)

    # 2) Sample data (from Pinecone quickstart)
    records = [
        {"_id": "rec1", "content": "The Eiffel Tower was completed in 1889 and stands in Paris, France.", "category": "history"},
        {"_id": "rec2", "content": "Photosynthesis allows plants to convert sunlight into energy.", "category": "science"},
        {"_id": "rec5", "content": "Shakespeare wrote many famous plays, including Hamlet and Macbeth.", "category": "literature"},
        {"_id": "rec7", "content": "The Great Wall of China was built to protect against invasions.", "category": "history"},
        {"_id": "rec15", "content": "Leonardo da Vinci painted the Mona Lisa.", "category": "art"},
        {"_id": "rec17", "content": "The Pyramids of Giza are among the Seven Wonders of the Ancient World.", "category": "history"},
        {"_id": "rec21", "content": "The Statue of Liberty was a gift from France to the United States.", "category": "history"},
        {"_id": "rec26", "content": "Rome was once the center of a vast empire.", "category": "history"},
        {"_id": "rec33", "content": "The violin is a string instrument commonly used in orchestras.", "category": "music"},
        {"_id": "rec38", "content": "The Taj Mahal is a mausoleum built by Emperor Shah Jahan.", "category": "history"},
        {"_id": "rec48", "content": "Vincent van Gogh painted Starry Night.", "category": "art"},
        {"_id": "rec50", "content": "Renewable energy sources include wind, solar, and hydroelectric power.", "category": "energy"},
    ]

    # 3) Upsert
    print(f"Upserting {len(records)} records into namespace '{namespace}'...")
    index.upsert_records(namespace, records)
    print("Waiting 10s for indexing...")
    time.sleep(10)

    # 4) Search with reranking
    query = "Famous historical structures and monuments"
    print(f"\nQuery: \"{query}\"\n")
    reranked = index.search(
        namespace=namespace,
        query={"top_k": 10, "inputs": {"text": query}},
        rerank={
            "model": "bge-reranker-v2-m3",
            "top_n": 10,
            "rank_fields": ["content"],
        },
    )

    # 5) Print results (handle both dict and object-style response)
    if isinstance(reranked, dict):
        hits = reranked.get("result", {}).get("hits", [])
    else:
        res = getattr(reranked, "result", None)
        hits = getattr(res, "hits", []) if res is not None else getattr(reranked, "hits", [])

    print("Top results (id, score, content, category):")
    for i, hit in enumerate(hits, 1):
        if isinstance(hit, dict):
            _id = hit.get("_id", hit.get("id", ""))
            score = hit.get("_score", hit.get("score", 0))
            fields = hit.get("fields", {})
        else:
            _id = getattr(hit, "_id", getattr(hit, "id", ""))
            score = getattr(hit, "_score", getattr(hit, "score", 0))
            fields = getattr(hit, "fields", {})
        content = (fields or {}).get("content", "")
        category = (fields or {}).get("category", "")
        print(f"  {i}. {_id} | {round(score, 3)} | {content[:60]}... | {category}")

    print("\nQuick test completed successfully.")

if __name__ == "__main__":
    main()
