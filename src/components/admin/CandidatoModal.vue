<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'
import { validarCandidato } from '@/lib/validators.js'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  candidato: { type: Object, default: null },
  cargos: { type: Array, default: () => [] },
  candidatos: { type: Array, default: () => [] },
  cargoPadrao: { type: String, default: '' },
  salvando: { type: Boolean, default: false },
  erroServidor: { type: String, default: '' }
})
const emit = defineEmits(['fechar', 'salvar'])

const form = reactive({
  cargo_id: '',
  numero: '',
  nome: '',
  nome_urna: '',
  chapa: '',
  vice: '',
  proposta: '',
  ativo: true
})
const erros = ref({})

const cargoSelecionado = computed(
  () => props.cargos.find((c) => c.id === form.cargo_id) || null
)
const digitos = computed(() => Number(cargoSelecionado.value?.digitos) || 2)

function preencher() {
  erros.value = {}
  const cargoInicial =
    props.candidato?.cargo_id ||
    props.cargoPadrao ||
    props.cargos[0]?.id ||
    ''

  if (props.candidato) {
    form.cargo_id = props.candidato.cargo_id || cargoInicial
    form.numero = String(props.candidato.numero || '')
    form.nome = props.candidato.nome || ''
    form.nome_urna = props.candidato.nome_urna || ''
    form.chapa = props.candidato.chapa || ''
    form.vice = props.candidato.vice || ''
    form.proposta = props.candidato.proposta || ''
    form.ativo = props.candidato.ativo !== false
  } else {
    form.cargo_id = cargoInicial
    form.numero = ''
    form.nome = ''
    form.nome_urna = ''
    form.chapa = ''
    form.vice = ''
    form.proposta = ''
    form.ativo = true
  }
}

watch(
  [() => props.aberto, () => props.candidato, () => props.cargos.length],
  ([aberto]) => {
    if (aberto) preencher()
  },
  { immediate: true }
)

function submit() {
  const resultado = validarCandidato(
    form,
    cargoSelecionado.value,
    props.candidatos,
    props.candidato?.id || null
  )
  erros.value = resultado.erros
  if (!resultado.ok) return

  emit('salvar', {
    cargo_id: form.cargo_id,
    numero: String(form.numero).trim(),
    nome: form.nome.trim(),
    nome_urna: form.nome_urna.trim(),
    chapa: form.chapa.trim(),
    vice: form.vice.trim(),
    proposta: form.proposta.trim(),
    ativo: form.ativo
  })
}
</script>

<template>
  <Modal
    :aberto="aberto"
    :titulo="candidato ? 'Editar candidato' : 'Novo candidato'"
    largo
    @fechar="emit('fechar')"
  >
    <form id="form-candidato" class="form-grid" @submit.prevent="submit">
      <div class="field field-full">
        <label for="cand-cargo">Cargo *</label>
        <select id="cand-cargo" v-model="form.cargo_id">
          <option value="" disabled>Selecione o cargo</option>
          <option v-for="cargo in cargos" :key="cargo.id" :value="cargo.id">
            {{ cargo.nome }} ({{ cargo.digitos }} dígitos)
          </option>
        </select>
        <small v-if="erros.cargo_id" class="field-error">{{ erros.cargo_id }}</small>
      </div>

      <div class="field">
        <label for="cand-numero">Número *</label>
        <input
          id="cand-numero"
          v-model="form.numero"
          type="text"
          inputmode="numeric"
          :maxlength="digitos"
          placeholder="Ex.: 10"
        />
        <small v-if="erros.numero" class="field-error">{{ erros.numero }}</small>
        <small v-else class="field-hint">Exatamente {{ digitos }} dígito(s).</small>
      </div>

      <div class="field">
        <label for="cand-nome-urna">Nome de urna</label>
        <input
          id="cand-nome-urna"
          v-model="form.nome_urna"
          type="text"
          maxlength="80"
          placeholder="Como aparece na urna"
        />
      </div>

      <div class="field field-full">
        <label for="cand-nome">Nome completo *</label>
        <input
          id="cand-nome"
          v-model="form.nome"
          type="text"
          maxlength="120"
          placeholder="Nome completo do candidato"
        />
        <small v-if="erros.nome" class="field-error">{{ erros.nome }}</small>
      </div>

      <div class="field">
        <label for="cand-chapa">Chapa</label>
        <input
          id="cand-chapa"
          v-model="form.chapa"
          type="text"
          maxlength="80"
          placeholder="Ex.: Chapa Renovação"
        />
      </div>

      <div class="field">
        <label for="cand-vice">Vice / suplente</label>
        <input
          id="cand-vice"
          v-model="form.vice"
          type="text"
          maxlength="120"
          placeholder="Nome do vice (opcional)"
        />
      </div>

      <div class="field field-full">
        <label for="cand-proposta">Proposta</label>
        <textarea
          id="cand-proposta"
          v-model="form.proposta"
          rows="3"
          maxlength="400"
          placeholder="Resumo da proposta (opcional)"
        ></textarea>
      </div>

      <label class="check field-full">
        <input v-model="form.ativo" type="checkbox" />
        <span>Candidato ativo na urna</span>
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
        form="form-candidato"
        :disabled="salvando"
      >
        {{ salvando ? 'Salvando...' : 'Salvar candidato' }}
      </button>
    </template>
  </Modal>
</template>
