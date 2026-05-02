# 📱 Finanças do Casal — Guia de Instalação

Siga este passo a passo. Leva cerca de 10–15 minutos.

---

## PARTE 1 — Criar o banco de dados (Firebase)

### 1.1 — Criar conta no Firebase
1. Acesse: https://console.firebase.google.com
2. Clique em **"Criar um projeto"**
3. Digite um nome (ex: `financas-casal`) e clique em **Continuar**
4. Desative o Google Analytics (não precisamos) → **Criar projeto**
5. Aguarde e clique em **Continuar**

### 1.2 — Ativar o banco de dados (Firestore)
1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** → **Avançar**
4. Escolha a região **southamerica-east1 (São Paulo)** → **Ativar**
5. Aguarde o banco ser criado

### 1.3 — Configurar as regras de segurança
1. No Firestore, clique na aba **"Regras"**
2. Apague todo o conteúdo e cole o seguinte:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /expenses/{doc} {
      allow read, write: if true;
    }
    match /config/{doc} {
      allow read, write: if true;
    }
  }
}
```

3. Clique em **Publicar**

### 1.4 — Pegar as credenciais do app
1. Na tela inicial do projeto, clique no ícone **`</>`** (Web)
2. Em "Apelido do app" escreva `financas-casal` → **Registrar app**
3. Vai aparecer um bloco de código com `firebaseConfig`. Copie os valores!
4. Abra o arquivo **`src/firebaseConfig.js`** e substitua cada campo:

```js
const firebaseConfig = {
  apiKey: "COLE_AQUI",           ← substitua pelo valor real
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};
```

---

## PARTE 2 — Publicar o app (GitHub + Vercel)

### 2.1 — Criar conta no GitHub
1. Acesse: https://github.com e crie uma conta gratuita (se não tiver)

### 2.2 — Criar repositório
1. Clique em **"New repository"**
2. Nome: `financas-casal`
3. Deixe como **Público** → **Create repository**

### 2.3 — Subir o código
Você tem duas opções:

**Opção A — Pelo site (mais fácil):**
1. Na página do repositório criado, clique em **"uploading an existing file"**
2. Arraste todos os arquivos da pasta `financas-casal` para lá
3. Clique em **"Commit changes"**

**Opção B — Pelo terminal (se tiver Git instalado):**
```bash
cd financas-casal
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/financas-casal.git
git push -u origin main
```

### 2.4 — Publicar no Vercel
1. Acesse: https://vercel.com e crie conta gratuita (pode usar o login do GitHub)
2. Clique em **"Add New Project"**
3. Selecione o repositório `financas-casal`
4. Clique em **"Deploy"** — sem alterar nada
5. Aguarde ~1 minuto

✅ **Pronto!** O Vercel vai gerar um link como:
`https://financas-casal.vercel.app`

---

## PARTE 3 — Usar no celular

1. Abra o link no navegador do seu celular
2. No iPhone: toque em **Compartilhar → Adicionar à Tela de Início**
3. No Android: toque nos **3 pontos → Adicionar à tela inicial**

Vira um ícone como se fosse um app! 📱

---

## 🔗 Compartilhar com sua esposa

Basta enviar o link do Vercel para ela via WhatsApp.
Cada um entra pelo próprio perfil e os dados são sincronizados em tempo real.

---

## ❓ Dúvidas comuns

**"Erro ao conectar no Firebase"**
→ Verifique se os valores no `firebaseConfig.js` foram colados corretamente (sem espaços extras)

**"Permission denied"**
→ Verifique se as regras do Firestore foram salvas (Parte 1.3)

**Os dados não aparecem**
→ Aguarde alguns segundos — o Firestore pode demorar um pouco na primeira conexão
