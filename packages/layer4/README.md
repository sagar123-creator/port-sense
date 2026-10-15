# Layer 4 — Lane Builder

Lane Builder → Comparator → Decision Engine.

This package is **not** inland haul. Inland ₹ lives in **Layer 6**.

- **Domestic:** modelled Indian gates into each other (JNPT, Chennai, Cochin, Vizag, Kolkata)  
- **Export:** those gates → Jebel Ali / Los Angeles  


Reads **only** Layer 2 via Layer 3 Cost/Risk. Never invents transit (null = insufficient).

```bash
cd layer2 && npm run seed
cd ../layer4 && npm install && npm run validate && npm run demo
```
