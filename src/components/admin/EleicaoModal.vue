<script setup>
import { reactive, ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  escolaPadrao: { type: String, default: '' },
  salvando: { type: Boolean, default: false },
  erroServidor: { type: String, default: '' }
})
const emit = defineEmits(['fechar', 'salvar'])

const form = reactive({
  escola_nome: '',
  nome: '',
  data_eleicao: ''
})
const erros = ref({})

function preencher() {
  form.escola_nome = props.escolaPadrao || ''
  form.nome = ''
  form.data_eleicao = ''
  erros.value = {}
}

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) preencher()
  },
  { immediate: true }
)

function submit() {
  const novos = {}
  if (!form.escola_nome.trim()) novos.escola_nome = 'Informe o nome da escola.'
  if (!form.nome.trim()) novos.nome = 'Informe o nome da eleição.'
  erros.value = novos
  if (Object.keys(novos).length) return

  emit('salvar', {
    escola_nome: form.escola_nome.trim(),
    nome: form.nome.trim(),
    data_eleicao: form.data_eleicao || null
  })
}
</script>

<template>
  <Modal :aberto="aberto" titulo="Nova eleição" @fechar="emit('fechar')">
    <form id="form-eleicao" class="form-grid" @submit.prevent="submit">
      <div class="field field-full">
        <label for="eleicao-escola">Nome da escola *</label>
        <input
          id="eleicao-escola"
          v-model="form.escola_nome"
          type="text"
          maxlength="120"
          placeholder="Ex.: Escola Estadual Professora Maria Silva"
        />
        <small v-if="erros.escola_nome" class="field-error">
          {{ erros.escola_nome }}
        </small>
      </div>

      <div class="field field-full">
        <label for="eleicao-nome">Nome da eleição *</label>
        <input
          id="eleicao-nome"
          v-model="form.nome"
          type="text"
          maxlength="120"
          placeholder="Ex.: Eleição do Grêmio Estudantil 2026"
        />
        <small v-if="erros.nome" class="field-error">{{ erros.nome }}</small>
      </div>

      <div class="field field-full">
        <label for="eleicao-data">Data da eleição</label>
        <input id="eleicao-data" v-model="form.data_eleicao" type="date" />
      </div>

      <div class="alert alert-info field-full">
        A eleição atual será arquivada. Cargos e candidatos não são copiados
        automaticamente; configure a nova eleição antes de abri-la.
      </div>

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
        form="form-eleicao"
        :disabled="salvando"
      >
        {{ salvando ? 'Criando...' : 'Criar eleição' }}
      </button>
    </template>
  </Modal>
</template>
