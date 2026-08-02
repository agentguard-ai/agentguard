# TealTiger

<div align="center">

<img src="../../.github/logo/tealtiger-logo-256.png" alt="TealTiger Logo" width="200">

**SDK de Gobernanza y Seguridad para Agentes de IA**

Gobernanza determinista, salvaguardas (guardrails), seguimiento de costos y gestión de políticas para aplicaciones LLM.
Código abierto. TypeScript + Python. Funciona con cualquier proveedor.

<br>

<a href="https://www.nvidia.com/en-us/startups/">
  <img src="../../.github/logo/nvidia-inception-badge.svg" alt="NVIDIA Inception Program" width="250">
</a>

<br>

[Sitio Web](https://tealtiger.co.in) · [Documentación](../../README.md#documentation) · [Ejemplos](../../examples) · [Discord](https://discord.gg/X2ePf8QAj) · [Contribuir](../../CONTRIBUTING.md)

</div>

---

## ⚡ Inicio rápido de 60 segundos

Instalación: `npm install tealtiger` o `pip install tealtiger`, luego envuelve una llamada existente a OpenAI:

```typescript
import { TealOpenAI } from 'tealtiger';
const client = new TealOpenAI({ apiKey: process.env.OPENAI_API_KEY, guardrails: { promptInjection: true } });
const res = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello!' }] });
console.log(res.security?.decision ?? 'ALLOW');
```

```python
import os
from tealtiger import TealOpenAI
client = TealOpenAI(api_key=os.environ["OPENAI_API_KEY"], guardrails={"prompt_injection": True})
print(client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": "Hello!"}]).security.decision)
```

```text
ALLOW
Governance receipt emitted; cost and guardrails tracked.
```

Siguiente: [Inicio rápido completo](#-inicio-rápido) y [ejemplos](../../examples).

---

## 🚀 Inicio Rápido

### TypeScript

```bash
npm install tealtiger
```

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: true,
    promptInjection: true,
    contentModeration: true,
  },
  budget: {
    maxCostPerRequest: 0.50,
    maxCostPerDay: 10.00,
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
// Guardrails enforced. Cost tracked. Evidence produced.
```

### Python

```bash
pip install tealtiger
```

```python
import os
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
    },
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 10.00,
    },
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
)
# Guardrails enforced. Cost tracked. Evidence produced.
```

---

## ✨ Características Principales

### 🛡️ Salvaguardas de Seguridad (Security Guardrails)
- **Detección de PII** — Detecta y oculta información confidencial automáticamente
- **Prevención de Inyección de Prompts** — Bloquea intentos maliciosos de inyección de prompts
- **Moderación de Contenido** — Filtra contenido tóxico, dañino o inapropiado
- **Detección de Secretos** — Más de 500 patrones en 9 categorías con puntuación de confianza
- **Reglas Personalizadas** — Define tus propias políticas de seguridad

### 💰 Gobernanza de Costos
- **Cumplimiento de Presupuesto** — Límites estrictos por solicitud, sesión y día
- **Seguimiento de Costos** — Monitoreo en tiempo real en todos los proveedores
- **Alertas de Costos** — Notificaciones en umbrales configurables
- **Interruptores Automáticos (Circuit Breakers)** — Previene bucles de costos descontrolados de forma automática
