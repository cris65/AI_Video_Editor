import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
FRAME_IO_TOKEN = os.getenv("FRAME_IO_TOKEN")

def query_graphql(query, variables=None):
    headers = {
        "Authorization": f"Bearer {FRAME_IO_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
        
    res = requests.post("https://api.frame.io/graphql", json=payload, headers=headers)
    return res

def discover_schema():
    print(f"🔍 Avvio Introspezione Schema GraphQL (V4) per capire i campi del Progetto...")
    
    query = """
    query {
      projectType: __type(name: "Project") {
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
    """
    
    res = query_graphql(query)
    
    if res.status_code == 200:
        data = res.json()
        if "errors" in data:
            print("❌ Errore Introspezione:")
            print(json.dumps(data["errors"], indent=2))
        else:
            fields = data.get("data", {}).get("projectType", {}).get("fields", [])
            print("\n✅ CAMPI DISPONIBILI SUL TIPO 'Project':")
            for f in fields:
                field_name = f.get('name')
                field_type = f.get('type', {})
                type_name = field_type.get('name') or (field_type.get('ofType') or {}).get('name')
                print(f"  - {field_name}: {type_name}")
    else:
        print(f"❌ Errore HTTP {res.status_code}: {res.text}")

if __name__ == "__main__":
    if not FRAME_IO_TOKEN:
        print("Errore: FRAME_IO_TOKEN non trovato nel file .env")
    else:
        discover_schema()