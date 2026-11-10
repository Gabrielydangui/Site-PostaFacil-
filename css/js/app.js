/* PostaFácil - Núcleo compartilhado: autenticação, dados e interface comum.
   Projeto didático: tudo fica no localStorage do navegador (sem servidor). */

const CHAVE_USUARIOS = "postafacil_usuarios";
const CHAVE_SESSAO = "postafacil_sessao";
const CHAVE_ENVIOS = "postafacil_envios";

function lerJSON(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (e) {
    return padrao;
  }
}

function salvarJSON(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

function formatarReais(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

async function gerarHash(senha) {
  // Senha nunca fica em texto puro: guardamos apenas o hash.
  if (window.crypto && crypto.subtle) {
    const bytes = new TextEncoder().encode(senha);
    const resumo = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(resumo))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Alternativa simples para quando o navegador não oferece crypto.subtle
  let h = 5381;
  for (let i = 0; i < senha.length; i++) {
    h = ((h << 5) + h + senha.charCodeAt(i)) | 0;
  }
  return "simples-" + h;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validarSenha(senha) {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return "Use letras e números na senha.";
  }
  return "";
}

const Auth = {
  async cadastrar(nome, email, senha) {
    const usuarios = lerJSON(CHAVE_USUARIOS, []);
    const emailNorm = email.trim().toLowerCase();
    if (usuarios.some((u) => u.email === emailNorm)) {
      return { ok: false, erro: "Este e-mail já está cadastrado." };
    }
    usuarios.push({
      nome: nome.trim(),
      email: emailNorm,
      hash: await gerarHash(senha),
    });
    salvarJSON(CHAVE_USUARIOS, usuarios);
    return { ok: true };
  },

  async entrar(email, senha) {
    const usuarios = lerJSON(CHAVE_USUARIOS, []);
    const emailNorm = email.trim().toLowerCase();
    const usuario = usuarios.find((u) => u.email === emailNorm);
    const hash = await gerarHash(senha);
    // Mesma mensagem para e-mail ou senha errados (não revela qual falhou).
    if (!usuario || usuario.hash !== hash) {
      return { ok: false, erro: "E-mail ou senha incorretos." };
    }
    salvarJSON(CHAVE_SESSAO, { nome: usuario.nome, email: usuario.email });
    return { ok: true };
  },

  usuarioAtual() {
    return lerJSON(CHAVE_SESSAO, null);
  },

  sair() {
    localStorage.removeItem(CHAVE_SESSAO);
    window.location.href = "index.html";
  },

  exigirLogin() {
    const usuario = Auth.usuarioAtual();
    if (!usuario) {
      window.location.href = "index.html";
      return null;
    }
    return usuario;
  },
};

const Envios = {
  listar(email) {
    return lerJSON(CHAVE_ENVIOS, []).filter((e) => e.email === email);
  },

  adicionar(envio) {
    const todos = lerJSON(CHAVE_ENVIOS, []);
    todos.unshift(envio);
    salvarJSON(CHAVE_ENVIOS, todos);
  },

  gerarCodigo() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const prefixo = letras[Math.floor(Math.random() * letras.length)] +
      letras[Math.floor(Math.random() * letras.length)];
    const numeros = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    return prefixo + numeros + "BR";
  },
};

/* Simulação de preço e prazo (valores fictícios) */
const REGIOES = {
  sul: ["PR", "SC", "RS"],
  sudeste: ["SP", "RJ", "MG", "ES"],
  centro: ["DF", "GO", "MT", "MS"],
  nordeste: ["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"],
  norte: ["AM", "PA", "AC", "RO", "RR", "AP", "TO"],
};

const FATOR_REGIAO = { sul: 1, sudeste: 1.1, centro: 1.3, nordeste: 1.5, norte: 1.8 };
const DIAS_PAC = { sul: 3, sudeste: 4, centro: 5, nordeste: 7, norte: 9 };
const DIAS_SEDEX = { sul: 1, sudeste: 1, centro: 2, nordeste: 3, norte: 4 };

function regiaoDoEstado(uf) {
  return Object.keys(REGIOES).find((r) => REGIOES[r].includes(uf)) || "sudeste";
}

function simularEnvio(uf, pesoGramas) {
  const regiao = regiaoDoEstado(uf);
  const fator = FATOR_REGIAO