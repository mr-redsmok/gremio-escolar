<script setup>
import { reactive, ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'
import { validarCargo } from '@/lib/validators.js'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  cargo: { type: Object, default: null },
  cargos: { type: Array, default: () => [] },
  candidatos: { type: Array, default: () => [] },
  proximoOrdem: { type: Number, default: 1 },
  digitosPadrao: { type: Number, default: 2 },
  salvando: { type: Boolean, default: false },
  erroServidor: { type: String, default: '' }
})
const emit = defineEmits(['fechar', 'salvar'])

const form = reactive({
  nome: '',
  descricao: '',
  ordem: 1,
  digitos: 2,
  permite_branco: true,
  ativo: true
})
const erros = ref({})

function preencher() {
  erros.value = {}
  if (props.cargo) {
    form.nome = props.cargo.nome || ''
    form.descricao = props.cargo.descricao || ''
    form.ordem = Number(props.cargo.ordem) || 1
    form.digitos = Number(props.cargo.digitos) || 2
    form.permite_branco = props.cargo.permite_branco !== false
    form.ativo = props.cargo.ativo !== false
  } else {
    form.nome = ''
    form.descricao = ''
    form.ordem = props.proximoOrdem || 1
    form.digitos = props.digitosPadrao || 2
    form.permite_branco = true
    form.ativo = true
  }
}

watch(
  [() => props.aberto, () => props.cargo],
  ([aberto]) => {
    if (aberto) preencher()
  },
  { immediate: true }
)

function submit() {
  const resultado = validarCargo(
    form,
    props.cargos,
    props.cargo?.id || null,
    props.candidatos
  )
  erros.value = resultado.erros
  if (!resultado.ok) return

  emit('salvar', {
    nome: form.nome.trim(),
    descricao: form.descricao.trim(),
    ordem: Number(form.ordem),
    digitos: Number(form.digitos),
    permite_branco: form.permite_branco,
    ativo: form.ativo
  })
}
</script>

<template>
  <Modal
    :aberto="aberto"
    :titulo="cargo ? 'Editar cargo' : 'Novo cargo'"
    @fechar="emit('fechar')"
  >
    <form id="form-cargo" class="form-grid" @submit.prevent="submit">
      <div class="field field-full">
        <label for="cargo-nome">Nome do cargo *</label>
        <input
          id="cargo-nome"
          v-model="form.nome"
          type="text"
          maxlength="80"
          placeholder="Ex.: Presidente, Vice-Presidente, Representante"
          autofocus
        />
        <small v-if="erros.nome" class="field-error">{{ erros.nome }}</small>
      </div>

      <div class="field field-full">
        <label for="cargo-descricao">Descrição</label>
        <textarea
          id="cargo-descricao"
          v-model="form.descricao"
          rows="2"
          maxlength="240"
          placeholder="Texto curto que aparece na urna (opcional)"
        ></textarea>
      </div>

      <div class="field">
        <label for="cargo-ordem">Ordem na urna</label>
        <input id="cargo-ordem" v-model.number="form.ordem" type="number" min="0" step="1" />
        <small v-if="erros.ordem" class="field-error">{{ erros.ordem }}</small>
        <small v-else class="field-hint">Menor número aparece primeiro.</small>
      </div>

      <div class="field">
        <label for="cargo-digitos">Dígitos do número</label>
        <select id="cargo-digitos" v-model.number="form.digitos">
          <option :value="2">2 dígitos (ex.: 10)</option>
          <option :value="3">3 dígitos (ex.: 101)</option>
          <option :value="4">4 dígitos (ex.: 1001)</option>
        </select>
        <small v-if="erros.digitos" class="field-error">{{ erros.digitos }}</small>
      </div>

      <label class="check">
        <input v-model="form.permite_branco" type="checkbox" />
        <span>Permitir voto em branco</span>
      </label>

      <label class="check">
        <input v-model="form.ativo" type="checkbox" />
        <span>Cargo ativo na urna</span>
      </label>

      <div v-if="erroServidor" class="alert alert-erro field-full">
        {{ erroServidor }}
      </div>
    </form>

    <template #footer>
      <button class="btn btn-ghost" type="button" @click="emit('fechar')">
        Cancelar
      </button>
      <button
        class="btn btn-primary"
        type="submit"
        form="form-cargo"
        :disabled="salvando"
      >
        {{ salvando ? 'Salvando...' : 'Salvar cargo' }}
      </button>
    </template>
  </Modal>
</template>
