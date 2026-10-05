  // A area selecionada define os textos e a lista local de cadastros.
    const requestedArea = new URLSearchParams(window.location.search).get("area") || "rede-de-clientes";
    const currentArea = requestedArea;
    const isDocumentationArea = currentArea === "documentacao";
    const isSettingsArea = currentArea === "configuracoes";
    const isPersonnelArea = currentArea === "departamento-pessoal";
    const financeAreas = ["financeiro-despesas", "financeiro-despesas-beneficios", "financeiro-despesas-boletos", "financeiro-receitas"];
    const isSupplierArea = currentArea === "financeiro-despesas-beneficios";
    const isBillsArea = currentArea === "financeiro-despesas-boletos";
    const isFinanceArea = financeAreas.includes(currentArea);
    const isAlternateArea = isSettingsArea || isPersonnelArea || isFinanceArea;
    const storageKey = "god-sistemas-clientes-v1";
    const employeesStorageKey = "god-sistemas-colaboradores-v1";
    const employeeBanksStorageKey = "god-sistemas-bancos-v1";
    const suppliersStorageKey = "god-sistemas-fornecedores-v1";
    const billsStorageKey = "god-sistemas-boletos-v1";
    const preferencesStorageKey = "god-sistemas-preferencias-v1";
    const documentationDatabaseName = "god-sistemas-documentos-v1";
    const documentationStoreName = "files";
    const dialog = document.querySelector("#client-dialog");
    const form = document.querySelector("#client-form");
    const rows = document.querySelector("#client-rows");
    const search = document.querySelector("#search");
    const emptyState = document.querySelector("#empty-state");
    const statusDropdown = document.querySelector("#status-dropdown");
    const statusMenuToggle = document.querySelector("#status-menu-toggle");
    const statusMenu = document.querySelector("#status-menu");
    const tableHead = document.querySelector("#client-table-head");
    const app = document.querySelector(".app");
    const sidebar = document.querySelector("#main-sidebar");
    const sidebarToggle = document.querySelector("#sidebar-toggle");
    const workStatuses = ["Não iniciada", "Em andamento", "Concluída"];
    const documentTypes = [
      { label: "Proposta", type: "proposal" },
      { label: "Contrato", type: "contract" },
      { label: "Ficha Cadastral", type: "registration" }
    ];
    const documentationStatuses = ["🔴 Pendente", "🟢 Completa"];
    const billViews = [
      { id: "payable", label: "A pagar" },
      { id: "payment", label: "Pago" },
      { id: "credit", label: "Crédito" }
    ];
    for (let missingMask = 1; missingMask < 7; missingMask += 1) {
      const missingDocuments = documentTypes.filter((_, index) => missingMask & (1 << index)).map((document) => document.label);
      documentationStatuses.push(`🟡 Pendente em ${missingDocuments.join(" e ")}`);
    }
    let clients = loadClients();
    let documentationFiles = new Map();
    let pendingCommercialFiles = new Map();
    let editingId = null;
    let editingEmployeeId = null;
    let activeEmployeeView = "gallery";
    let activeContractFilter = "Todas";
    let activeBillView = "payable";
    let employeePhotoPreviewUrl = null;
    const employeePhotoUrls = new Map();
    let activeStatus = isDocumentationArea ? "Todas as etapas" : "Todas";
    let toastTimer;
    let documentationFilesReady = Promise.resolve();

    sidebarToggle.addEventListener("click", () => {
      const collapsed = app.classList.toggle("sidebar-collapsed");
      sidebar.inert = collapsed;
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
      sidebarToggle.setAttribute("aria-label", collapsed ? "Abrir navegação lateral" : "Fechar navegação lateral");
    });

    function getAreaStatuses() {
      return isDocumentationArea ? documentationStatuses : workStatuses;
    }

    function getStatusLabel() {
      return isDocumentationArea ? "Todas as etapas" : "Todas";
    }

    function renderStatusMenu() {
      const allLabel = getStatusLabel();
      const statuses = isDocumentationArea ? [allLabel, ...getAreaStatuses()] : getAreaStatuses();
      statusMenu.setAttribute("aria-label", isDocumentationArea ? "Etapas do processo" : "Situações da obra");
      statusMenuToggle.setAttribute("aria-label", isDocumentationArea ? "Filtrar documentação por etapa" : "Filtrar obras por situação");
      statusMenu.innerHTML = statuses.map((status) => `
        <button class="status-menu-item" type="button" role="menuitemradio" data-status="${escapeHtml(status)}" aria-checked="${String(activeStatus === status)}">
          <span>${escapeHtml(status)}</span><span class="status-count">0</span>
        </button>`).join("");
    }

    function getWorkStatus(client) {
      if (workStatuses.includes(client.workStatus)) return client.workStatus;
      if (workStatuses.includes(client.status)) return client.status;
      if (client.status === "Finalizada" || client.status === "Completa") return "Concluída";
      return "Não iniciada";
    }

    function getDocumentationStatus(client) {
      const missingDocuments = documentTypes
        .filter((document) => !documentationFiles.has(`${client.id}:${document.type}`)
          && (!(client.id === editingId || !client.id) || !pendingCommercialFiles.has(document.type)))
        .map((document) => document.label);
      if (missingDocuments.length === 0) return "🟢 Completa";
      if (missingDocuments.length === documentTypes.length) return "🔴 Pendente";
      return `🟡 Pendente em ${missingDocuments.join(" e ")}`;
    }

    function updateCommercialDocumentFields(clientId) {
      documentTypes.forEach((docInfo) => {
        const container = document.querySelector(`#commercial-${docInfo.type}`);
        const key = clientId ? `${clientId}:${docInfo.type}` : "";
        const file = key ? documentationFiles.get(key) : null;
        const name = container.querySelector(".linked-document-name");
        const pendingFile = pendingCommercialFiles.get(docInfo.type);
        name.replaceChildren();
        if (pendingFile) {
          name.textContent = pendingFile.name;
        } else if (file) {
          const link = document.createElement("button");
          link.className = "document-file-name";
          link.type = "button";
          link.dataset.fileAction = "download";
          link.dataset.fileKey = key;
          link.title = `Baixar ${file.name}`;
          link.textContent = file.name;
          name.append(link);
        } else {
          name.textContent = "Sem documento anexado.";
        }
      });
      const client = clients.find((item) => item.id === clientId);
      document.querySelector("#commercial-documentation-status").textContent = getDocumentationStatus(client || { id: "" });
    }

    const areaLabels = {
      "rede-de-clientes": "Área comercial",
      documentacao: "Área comercial",
      configuracoes: "Preferências",
      "departamento-pessoal": "Departamento Pessoal",
      "financeiro-despesas": "Financeiro · Despesas",
      "financeiro-despesas-beneficios": "Financeiro · Despesas · Benefícios",
      "financeiro-despesas-boletos": "Financeiro · Despesas · Boletos",
      "financeiro-receitas": "Financeiro · Receitas"
    };
    document.querySelector("#top-label").lastChild.textContent = areaLabels[currentArea] || areaLabels["rede-de-clientes"];
    document.querySelector("#client-content").hidden = isAlternateArea;
    document.querySelector("#settings-page").hidden = !isSettingsArea;
    document.querySelector("#personnel-page").hidden = !isPersonnelArea;
    document.querySelector("#finance-page").hidden = !isFinanceArea;
    document.querySelector("#client-dialog").hidden = isAlternateArea;
    document.querySelector("#employee-dialog").hidden = !isPersonnelArea;
    document.querySelector("#settings-page").classList.toggle("alternate-page-active", isSettingsArea);
    document.querySelector("#personnel-page").classList.toggle("alternate-page-active", isPersonnelArea);
    document.querySelector("#finance-page").classList.toggle("alternate-page-active", isFinanceArea);
    document.querySelector("#page-title").textContent = isDocumentationArea ? "Documentação" : "Rede de Clientes";
    document.querySelector("#add-client-label").textContent = isDocumentationArea ? "Novo registro" : "Novo cliente";
    document.querySelector("#empty-add").textContent = isDocumentationArea ? "Cadastrar primeiro registro" : "Cadastrar primeiro cliente";
    renderStatusMenu();
    if (isDocumentationArea) {
      document.querySelector("#add-client").hidden = true;
      document.querySelector("#client-section").setAttribute("aria-label", "Documentação dos clientes");
      document.querySelector("#search").placeholder = "Buscar construtora ou obra";
      document.querySelector("#search").setAttribute("aria-label", "Buscar construtora ou obra");
      document.querySelector("#table-footer").textContent = "Construtora, obra e tempo vêm da Rede de Clientes. Os anexos ficam salvos neste navegador.";
      document.querySelector("#empty-add").hidden = true;
      document.querySelector("table").classList.add("documentation-table");
      tableHead.innerHTML = "<tr><th>Construtora / obra</th><th>Etapa do processo</th><th>Proposta</th><th>Contrato</th><th>Ficha Cadastral</th><th>Tempo de Obra</th></tr>";
    }
    document.querySelector("#commercial-dropdown").open = isDocumentationArea || currentArea === "rede-de-clientes";
    document.querySelector("#administrative-dropdown").open = isPersonnelArea || isFinanceArea;
    document.querySelectorAll(".nav-subitem, .settings-link").forEach((link) => {
      if (link.dataset.area === currentArea) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });
    document.querySelectorAll(".nav-nested-dropdown")[0].open = isFinanceArea;
    document.querySelectorAll(".nav-nested-dropdown")[1].open = currentArea.startsWith("financeiro-despesas-");
    document.title = `${isSettingsArea ? "Preferências" : isPersonnelArea ? "Departamento Pessoal" : isFinanceArea ? "Financeiro" : isDocumentationArea ? "Documentação" : "Rede de Clientes"} | GOD Sistemas de Proteções`;
    if (isFinanceArea) {
      const financeTitle = {
        "financeiro-despesas": "Despesas",
        "financeiro-despesas-beneficios": "Benefícios",
        "financeiro-despesas-boletos": "Boletos",
        "financeiro-receitas": "Receitas"
      }[currentArea];
      const financeEmptyTitle = {
        "financeiro-despesas": "Nenhuma despesa cadastrada",
        "financeiro-despesas-beneficios": "Nenhum benefício cadastrado",
        "financeiro-despesas-boletos": "Nenhum boleto cadastrado",
        "financeiro-receitas": "Nenhuma receita cadastrada"
      }[currentArea];
      const financePageTitle = isSupplierArea ? "Fornecedores" : isBillsArea ? "Boletos" : financeTitle;
      document.querySelector("#finance-title").textContent = financePageTitle;
      document.querySelector("#finance-eyebrow").hidden = isSupplierArea;
      document.querySelector("#finance-description").textContent = isSupplierArea || isBillsArea
        ? ""
        : `Acompanhe os lançamentos de ${financeTitle.toLocaleLowerCase("pt-BR")}.`;
      document.querySelector("#finance-description").hidden = isSupplierArea || isBillsArea;
      document.querySelector("#add-finance-record-label").textContent = isSupplierArea ? "Novo fornecedor" : isBillsArea ? "Novo boleto" : "Novo";
      document.querySelector("#supplier-page").hidden = !isSupplierArea;
      document.querySelector("#bill-page").hidden = !isBillsArea;
      document.querySelector("#finance-placeholder").hidden = isSupplierArea || isBillsArea;
      document.querySelector("#supplier-dialog").hidden = !isSupplierArea;
      document.querySelector("#bill-dialog").hidden = !isBillsArea;
      document.querySelector("#finance-empty-title").textContent = financeEmptyTitle;
    }

    function loadPreferences() {
      try {
        const stored = JSON.parse(localStorage.getItem(preferencesStorageKey) || "{}");
        return {
          theme: ["system", "light", "dark"].includes(stored.theme) ? stored.theme : "light",
          language: ["pt-BR", "en-US", "es"].includes(stored.language) ? stored.language : "pt-BR",
          timezone: ["local", "America/Sao_Paulo", "UTC"].includes(stored.timezone) ? stored.timezone : "local"
        };
      } catch {
        return { theme: "light", language: "pt-BR", timezone: "local" };
      }
    }

    let preferences = loadPreferences();

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
    }

    function savePreferences() {
      localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
      applyTheme(preferences.theme);
      document.documentElement.lang = preferences.language;
      document.querySelector("#settings-feedback").textContent = "Preferências salvas neste dispositivo.";
    }

    applyTheme(preferences.theme);
    document.documentElement.lang = preferences.language;
    if (isSettingsArea) {
      document.querySelector("#theme-preference").value = preferences.theme;
      document.querySelector("#language-preference").value = preferences.language;
      document.querySelector("#timezone-preference").value = preferences.timezone;
    }

    function loadEmployees() {
      try {
        const stored = JSON.parse(localStorage.getItem(employeesStorageKey) || "[]");
        return Array.isArray(stored) ? stored.filter((employee) => employee && typeof employee.id === "string" && typeof employee.name === "string") : [];
      } catch {
        return [];
      }
    }

    let employees = loadEmployees();

    function saveEmployees() {
      localStorage.setItem(employeesStorageKey, JSON.stringify(employees));
    }

    const defaultEmployeeBanks = [
      "Banco do Brasil",
      "Bradesco",
      "Caixa Econômica Federal",
      "Itaú",
      "Santander",
      "Nubank",
      "Banco Inter",
      "C6 Bank",
      "Sicredi",
      "Sicoob",
      "BTG Pactual",
      "Banco Safra",
      "Banrisul",
      "Mercado Pago",
      "PicPay"
    ];

    function loadEmployeeBanks() {
      try {
        const stored = JSON.parse(localStorage.getItem(employeeBanksStorageKey) || "[]");
        return Array.isArray(stored) ? stored.filter((bank) => typeof bank === "string" && bank.trim()) : [];
      } catch (error) {
        console.error("Não foi possível carregar a lista de bancos.", error);
        return [];
      }
    }

    let employeeBanks = [...new Set([...defaultEmployeeBanks, ...loadEmployeeBanks()])];

    function renderEmployeeBankOptions(selectedBank = "") {
      const bankSelect = document.querySelector("#employee-bank");
      const savedBanks = employees.map((employee) => employee.bank).filter((bank) => typeof bank === "string" && bank.trim());
      const options = [...new Set([...employeeBanks, ...savedBanks, selectedBank].filter(Boolean))].sort((first, second) => first.localeCompare(second, "pt-BR"));
      bankSelect.innerHTML = '<option value="">Selecione</option>' + options.map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`).join("");
      bankSelect.value = selectedBank;
    }

    function parseEmployeeDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    }

    function addEmployeeMonths(date, months) {
      const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(date.getDate(), lastDay));
      return target;
    }

    function formatEmployeeRegistrationTime(value) {
      if (!value) return "Sem data de admissão";
      const admissionDate = parseEmployeeDate(value);
      if (!admissionDate) return "Data de admissão inválida";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (admissionDate > today) return "Data de admissão futura";

      let years = today.getFullYear() - admissionDate.getFullYear();
      let anniversary = addEmployeeMonths(admissionDate, years * 12);
      if (anniversary > today) {
        years -= 1;
        anniversary = addEmployeeMonths(admissionDate, years * 12);
      }

      let months = (today.getFullYear() - anniversary.getFullYear()) * 12 + today.getMonth() - anniversary.getMonth();
      let elapsedMonths = addEmployeeMonths(admissionDate, years * 12 + months);
      if (elapsedMonths > today) {
        months -= 1;
        elapsedMonths = addEmployeeMonths(admissionDate, years * 12 + months);
      }
      const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const utcElapsedMonths = Date.UTC(elapsedMonths.getFullYear(), elapsedMonths.getMonth(), elapsedMonths.getDate());
      const days = Math.floor((utcToday - utcElapsedMonths) / 86400000);
      return `${years} ${years === 1 ? "ano" : "anos"}, ${months} ${months === 1 ? "mês" : "meses"}, ${days} ${days === 1 ? "dia" : "dias"}`;
    }

    function getEmployeeBirthday(value) {
      const birthDate = parseEmployeeDate(value);
      if (!birthDate) return "";
      const year = new Date().getFullYear();
      const month = birthDate.getMonth();
      const day = Math.min(birthDate.getDate(), new Date(year, month + 1, 0).getDate());
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function updateEmployeeComputedFields() {
      const employeeForm = document.querySelector("#employee-form");
      document.querySelector("#employee-registration-time").value = formatEmployeeRegistrationTime(employeeForm.elements.admissionDate.value);
      document.querySelector("#employee-birthday").value = getEmployeeBirthday(employeeForm.elements.birthDate.value);
    }

    function getEmployeePhotoKey(employeeId) {
      return `employee:${employeeId}:photo`;
    }

    function getEmployeePhotoUrl(employeeId) {
      const key = getEmployeePhotoKey(employeeId);
      const photo = documentationFiles.get(key);
      if (!photo?.blob) return "";
      if (!employeePhotoUrls.has(key)) employeePhotoUrls.set(key, URL.createObjectURL(photo.blob));
      return employeePhotoUrls.get(key);
    }

    function updateEmployeePhotoPreview(file = null) {
      if (employeePhotoPreviewUrl) URL.revokeObjectURL(employeePhotoPreviewUrl);
      employeePhotoPreviewUrl = file ? URL.createObjectURL(file) : null;
      const preview = document.querySelector("#employee-photo-preview");
      const empty = document.querySelector("#employee-photo-empty");
      const savedPhoto = editingEmployeeId && documentationFiles.get(getEmployeePhotoKey(editingEmployeeId));
      const photoUrl = employeePhotoPreviewUrl || (savedPhoto && getEmployeePhotoUrl(editingEmployeeId));
      preview.hidden = !photoUrl;
      preview.removeAttribute("src");
      if (photoUrl) preview.src = photoUrl;
      empty.hidden = Boolean(photoUrl);
      document.querySelector("#employee-photo-filename").textContent = file?.name || savedPhoto?.name || "JPG, PNG ou outro formato de imagem (até 10 MB)";
    }

    async function saveEmployeePhoto(employeeId, file) {
      const database = await openDocumentationDatabase();
      const record = { key: getEmployeePhotoKey(employeeId), employeeId, type: "employee-photo", name: file.name, blob: file, updatedAt: Date.now() };
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(documentationStoreName, "readwrite");
          transaction.objectStore(documentationStoreName).put(record);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
      const oldUrl = employeePhotoUrls.get(record.key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      employeePhotoUrls.delete(record.key);
      documentationFiles.set(record.key, record);
    }

    function renderEmployeeCards(group) {
      return group.map((employee) => {
        const photoUrl = getEmployeePhotoUrl(employee.id);
        const avatar = photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="Foto de ${escapeHtml(employee.name)}">`
          : escapeHtml(employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR"));
        return `
          <article class="employee-card">
            <div class="employee-avatar ${photoUrl ? "has-photo" : ""}">${avatar}</div>
            <div class="employee-card-body"><h3>${escapeHtml(employee.name)}</h3><span class="employee-tag">${escapeHtml(employee.department)}</span><span class="employee-tag employee-tag-function">${escapeHtml(employee.jobFunction)}</span><span class="employee-active ${employee.active ? "is-active" : "is-inactive"}"><span></span>${employee.active ? "Ativo" : "Inativo"}</span>
              <div class="employee-card-actions"><span>${escapeHtml(employee.contract || "Contrato não informado")}</span><button type="button" class="employee-edit" data-employee-id="${escapeHtml(employee.id)}">Editar</button></div>
            </div>
          </article>`;
      }).join("");
    }

    function renderEmployees() {
      const grid = document.querySelector("#employee-grid");
      const empty = document.querySelector("#employee-empty");
      const contractFilter = document.querySelector("#employee-contract-dropdown");
      contractFilter.hidden = activeEmployeeView !== "contracts";
      if (activeEmployeeView === "departments" || activeEmployeeView === "functions") {
        const property = activeEmployeeView === "departments" ? "department" : "jobFunction";
        const groupedEmployees = employees.reduce((groups, employee) => {
              const groupName = employee[property] || "Sem classificação";
              groups.set(groupName, [...(groups.get(groupName) || []), employee]);
              return groups;
            }, new Map());
        grid.innerHTML = [...groupedEmployees.entries()].map(([name, group]) => `
          <article class="employee-group-card"><span class="employee-group-count">${group.length}</span><h3>${escapeHtml(name)}</h3><p>${group.length} ${group.length === 1 ? "colaborador" : "colaboradores"}</p></article>`).join("");
        empty.hidden = groupedEmployees.size > 0;
      } else if (activeEmployeeView === "contracts") {
        const contracts = [
          { name: "CLT", matches: ["clt"] },
          { name: "Contrato Social", matches: ["contrato social"] },
          { name: "Freelancer/Autônomo", matches: ["freelancer/autônomo", "freelancer/autonomo"] }
        ];
        const contractMatches = (employee, contract) => contract.matches.includes(String(employee.contract || "").trim().toLocaleLowerCase("pt-BR"));
        const selectedContract = contracts.find((contract) => contract.name === activeContractFilter);
        const displayedEmployees = selectedContract ? employees.filter((employee) => contractMatches(employee, selectedContract)) : employees;
        const menu = document.querySelector("#employee-contract-menu");
        const toggle = document.querySelector("#employee-contract-toggle");
        document.querySelector("#employee-contract-label").textContent = activeContractFilter;
        document.querySelector("#employee-contract-count").textContent = displayedEmployees.length;
        toggle.setAttribute("aria-label", `Filtrar colaboradores por contrato. ${activeContractFilter}: ${displayedEmployees.length}`);
        menu.innerHTML = [{ name: "Todas", matches: [] }, ...contracts].map((contract) => {
          const count = contract.name === "Todas" ? employees.length : employees.filter((employee) => contractMatches(employee, contract)).length;
          return `<button class="status-menu-item" type="button" role="menuitemradio" data-contract="${escapeHtml(contract.name)}" aria-checked="${String(activeContractFilter === contract.name)}"><span>${escapeHtml(contract.name)}</span><span class="status-count">${count}</span></button>`;
        }).join("");
        grid.innerHTML = renderEmployeeCards(displayedEmployees);
        empty.hidden = displayedEmployees.length > 0;
      } else {
        grid.innerHTML = renderEmployeeCards(employees);
        empty.hidden = employees.length > 0;
      }
    }

    if (isPersonnelArea) renderEmployees();

    function loadClients() {
      // Recupera os cadastros deste navegador; dados invalidos iniciam uma lista vazia.
      try {
        const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string") : [];
      } catch {
        return [];
      }
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    }

    function loadFinanceRecords(key) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(stored) ? stored.filter((record) => record && typeof record.id === "string") : [];
      } catch (error) {
        console.error(`Não foi possível carregar os dados salvos em ${key}.`, error);
        return [];
      }
    }

    let suppliers = loadFinanceRecords(suppliersStorageKey);
    let bills = loadFinanceRecords(billsStorageKey);
    let editingSupplierId = null;
    let editingBillId = null;
    let supplierPhotoPreviewUrl = null;

    function parseMoney(value) {
      const normalized = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
      if (!normalized) return 0;
      const decimalNormalized = normalized.includes(",")
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized;
      const amount = Number(decimalNormalized);
      return Number.isFinite(amount) ? amount : 0;
    }

    function formatMoney(value) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
    }

    function getTodayInputDate() {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return `${today.getFullYear()}-${month}-${day}`;
    }

    function saveFinanceRecords(key, records) {
      localStorage.setItem(key, JSON.stringify(records));
    }

    function getFinanceFileUrl(key) {
      const file = documentationFiles.get(key);
      if (!file?.blob) return "";
      if (!employeePhotoUrls.has(key)) employeePhotoUrls.set(key, URL.createObjectURL(file.blob));
      return employeePhotoUrls.get(key);
    }

    async function saveFinanceFile(key, ownerId, type, file) {
      const database = await openDocumentationDatabase();
      const record = { key, ownerId, type, name: file.name, blob: file, updatedAt: Date.now() };
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(documentationStoreName, "readwrite");
          transaction.objectStore(documentationStoreName).put(record);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
      const oldUrl = employeePhotoUrls.get(key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      employeePhotoUrls.delete(key);
      documentationFiles.set(key, record);
    }

    function getSupplierPhotoUrl(supplierId) {
      return getFinanceFileUrl(`supplier:${supplierId}:photo`);
    }

    function renderSuppliers() {
      const query = document.querySelector("#supplier-search").value.trim().toLocaleLowerCase("pt-BR");
      const filtered = suppliers.filter((supplier) => `${supplier.name} ${supplier.category || ""} ${supplier.contact || ""}`.toLocaleLowerCase("pt-BR").includes(query));
      document.querySelector("#supplier-grid").innerHTML = filtered.map((supplier) => {
        const photoUrl = getSupplierPhotoUrl(supplier.id);
        const image = photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="Imagem de ${escapeHtml(supplier.name)}">`
          : `<span class="supplier-avatar-fallback" aria-hidden="true">${escapeHtml(supplier.name.slice(0, 1).toLocaleUpperCase("pt-BR"))}</span>`;
        return `<article class="supplier-card"><div class="supplier-card-image">${image}</div><div class="supplier-card-body"><h2>${escapeHtml(supplier.name)}</h2>${supplier.category ? `<span class="employee-tag">${escapeHtml(supplier.category)}</span>` : ""}${supplier.contact ? `<p>${escapeHtml(supplier.contact)}</p>` : ""}<div class="employee-card-actions"><span>${escapeHtml(supplier.phone || supplier.email || "Fornecedor")}</span><button type="button" class="employee-edit" data-edit-supplier="${escapeHtml(supplier.id)}">Editar</button></div></div></article>`;
      }).join("");
      document.querySelector("#supplier-empty").hidden = filtered.length > 0;
    }

    function getBillStatus(bill) {
      if (bill.paymentDate) return { label: "Pago", className: "status-completed" };
      const dueDate = parseDate(bill.dueDate);
      if (dueDate && dueDate < getTodayDate()) return { label: "Em atraso", className: "status-pending" };
      return { label: "A pagar", className: "status-pending-contract" };
    }

    function billMatchesView(bill, view) {
      if (view === "payable") return !bill.paymentDate && bill.kind !== "credit";
      if (view === "payment") return Boolean(bill.paymentDate) && bill.kind !== "credit";
      return bill.kind === "credit";
    }

    function billMatchesSearch(bill, query) {
      const supplier = suppliers.find((item) => item.id === bill.supplierId);
      return `${bill.number || ""} ${supplier?.name || bill.supplierName || ""} ${bill.details || ""} ${bill.method || ""} ${bill.bank || ""} ${bill.installment || ""} ${bill.responsible || ""} ${bill.creditType || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    }

    function renderBills() {
      const query = document.querySelector("#bill-search").value.trim().toLocaleLowerCase("pt-BR");
      const billViewMenu = document.querySelector("#bill-view-menu");
      const billView = billViews.find((view) => view.id === activeBillView) || billViews[0];
      const viewCounts = Object.fromEntries(billViews.map((view) => [
        view.id,
        bills.filter((bill) => billMatchesSearch(bill, query) && billMatchesView(bill, view.id)).length
      ]));
      document.querySelector("#bill-view-current-label").textContent = billView.label;
      document.querySelector("#selected-bill-view-count").textContent = viewCounts[billView.id];
      billViewMenu.innerHTML = billViews.map((view) => `
        <button class="status-menu-item" type="button" role="menuitemradio" data-bill-view="${view.id}" aria-checked="${String(view.id === billView.id)}">
          <span>${view.label}</span><span class="status-count">${viewCounts[view.id]}</span>
        </button>`).join("");
      const payableColumns = [
        { key: "number", label: "N° DO BOLETO" },
        { key: "beneficiary", label: "Beneficiário" },
        { key: "document", label: "Documento" },
        { key: "value", label: "Valor" },
        { key: "dueDate", label: "Dia Vencimento" },
        { key: "advancePaymentDate", label: "Antecipação Pagamento" },
        { key: "paymentDate", label: "Dia Pagamento" },
        { key: "fees", label: "Encargos" },
        { key: "receipt", label: "Comprovante" },
        { key: "status", label: "Situação" },
        { key: "details", label: "Observação" },
        { key: "method", label: "Método" },
        { key: "bank", label: "Banco" }
      ];
      const paidColumns = payableColumns.filter(({ key }) => key !== "dueDate");
      const creditColumns = [
        { key: "number", label: "N° DO BOLETO" },
        { key: "beneficiary", label: "Beneficiário" },
        { key: "document", label: "Documento" },
        { key: "dueDate", label: "Vencimento" },
        { key: "paymentDate", label: "Dia Pagamento" },
        { key: "value", label: "Valor" },
        { key: "status", label: "Situação" },
        { key: "installment", label: "Parcela" },
        { key: "bank", label: "Banco" },
        { key: "responsible", label: "Responsável" },
        { key: "creditType", label: "Tipo" },
        { key: "receipt", label: "Comprovante" }
      ];
      const columns = activeBillView === "payment"
        ? paidColumns
        : activeBillView === "credit"
          ? creditColumns
          : payableColumns;
      document.querySelector("#bill-headers").innerHTML = `${columns.map(({ label }) => `<th>${label}</th>`).join("")}<th><span class="sr-only">Ações</span></th>`;
      const visibleBills = bills.filter((bill) => billMatchesSearch(bill, query) && billMatchesView(bill, billView.id))
        .sort((first, second) => (first.dueDate || "9999-12-31").localeCompare(second.dueDate || "9999-12-31"));

      const rows = visibleBills.map((bill) => {
        const supplier = suppliers.find((item) => item.id === bill.supplierId);
        const documentFile = documentationFiles.get(`bill:${bill.id}:document`);
        const receiptFile = documentationFiles.get(`bill:${bill.id}:receipt`);
        const status = getBillStatus(bill);
        const amountDue = parseMoney(bill.value) + parseMoney(bill.fees);
        const cells = {
          number: escapeHtml(bill.number || "—"),
          beneficiary: escapeHtml(supplier?.name || bill.supplierName || "Fornecedor removido"),
          document: documentFile ? `<button class="document-file-name" type="button" data-file-action="download" data-file-key="bill:${escapeHtml(bill.id)}:document">${escapeHtml(documentFile.name)}</button>` : '<span class="document-empty">Sem arquivo</span>',
          value: formatMoney(parseMoney(bill.value)),
          dueDate: formatClientDate(bill.dueDate),
          advancePaymentDate: formatClientDate(bill.advancePaymentDate),
          paymentDate: formatClientDate(bill.paymentDate),
          fees: formatMoney(parseMoney(bill.fees)),
          receipt: receiptFile ? `<button class="document-file-name" type="button" data-file-action="download" data-file-key="bill:${escapeHtml(bill.id)}:receipt">${escapeHtml(receiptFile.name)}</button>` : bill.receiptName ? escapeHtml(bill.receiptName) : '<span class="document-empty">—</span>',
          status: `<span class="status-badge ${status.className}">${status.label}</span>`,
          details: escapeHtml(bill.details || "—"),
          method: escapeHtml(bill.method || "—"),
          bank: escapeHtml(bill.bank || "—"),
          installment: escapeHtml(bill.installment || "—"),
          responsible: escapeHtml(bill.responsible || "—"),
          creditType: escapeHtml(bill.creditType || "—")
        };
        const actionCell = `<td class="action-cell"><button class="icon-button" type="button" data-edit-bill="${escapeHtml(bill.id)}" aria-label="Editar boleto" title="Editar">✎</button><button class="icon-button" type="button" data-delete-bill="${escapeHtml(bill.id)}" aria-label="Excluir boleto" title="Excluir">×</button></td>`;
        return `<tr>${columns.map(({ key }) => `<td${key === "number" ? ' class="primary-cell"' : ""}>${cells[key]}</td>`).join("")}${actionCell}</tr>`;
      });
      const emptyTitle = query
        ? "Nenhum boleto encontrado"
        : activeBillView === "payment"
          ? "Nenhum boleto pago"
          : activeBillView === "credit"
            ? "Nenhum crédito cadastrado"
            : "Nenhum boleto cadastrado";
      document.querySelector("#bill-rows").innerHTML = rows.length
        ? rows.join("")
        : `<tr class="bill-empty-row"><td colspan="${columns.length + 1}"><div class="bill-empty-state"><span class="finance-empty-icon" aria-hidden="true">$</span><h2>${emptyTitle}</h2></div></td></tr>`;
      updateBillHorizontalScroll();
      const total = visibleBills.reduce((sum, bill) => sum + parseMoney(bill.value) + parseMoney(bill.fees), 0);
      document.querySelector("#bill-total").textContent = formatMoney(total);
      document.querySelector("#bill-total-label").textContent = activeBillView === "payment" ? "Total pago" : activeBillView === "credit" ? "Total de crédito" : "Total a pagar";
    }

    function updateBillHorizontalScroll() {
      const table = document.querySelector("#bill-table");
      const scrollContent = document.querySelector("#bill-horizontal-scroll-content");
      if (!table || !scrollContent) return;
      scrollContent.style.width = `${table.scrollWidth}px`;
    }

    function normalizeCnpj(value) {
      return String(value ?? "").replace(/\D/g, "");
    }

    function parseDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
    }

    function getTodayDate() {
      const today = new Date();
      return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    }

    function formatClientDate(value) {
      const date = parseDate(value);
      if (!date) return "—";
      date.setUTCHours(12);
      const timeZone = preferences.timezone === "local" ? undefined : preferences.timezone;
      return new Intl.DateTimeFormat(preferences.language, { timeZone }).format(date);
    }

    function getWholeMonthsBetween(start, end) {
      const monthDifference = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
      if (monthDifference > 0 && end.getUTCDate() < start.getUTCDate()) return monthDifference - 1;
      if (monthDifference < 0 && end.getUTCDate() > start.getUTCDate()) return monthDifference + 1;
      return monthDifference;
    }

    function getWorkDuration(client) {
      const start = parseDate(client.startDate);
      if (!start) return "Não iniciada";
      const actualEnd = parseDate(client.actualEndDate);
      const today = getTodayDate();
      if (!actualEnd && today < start) return "Não iniciada";
      const end = actualEnd || today;
      if (end < start) return "Término anterior ao início";

      const daysBetween = Math.floor((end - start) / 86400000);
      const monthsBetween = getWholeMonthsBetween(start, end);
      const years = Math.floor(monthsBetween / 12);
      const months = monthsBetween % 12;
      const days = daysBetween - monthsBetween * 30;
      return [
        years > 0 ? `${years} ${years === 1 ? "ano" : "anos"}` : "",
        months > 0 ? `${months} ${months === 1 ? "mês" : "meses"}` : "",
        days > 0 ? `${days} ${days === 1 ? "dia" : "dias"}` : "0 dias"
      ].filter(Boolean).join(" ");
    }

    function getPlannedDuration(client) {
      const start = parseDate(client.startDate);
      const end = parseDate(client.plannedEndDate);
      if (!start || !end) return "—";
      const months = getWholeMonthsBetween(start, end);
      return months < 0 ? "Término anterior ao início" : String(months);
    }

    function isClientActive(client) {
      const start = parseDate(client.startDate);
      if (!start) return false;
      const today = getTodayDate();
      const end = parseDate(client.actualEndDate) || parseDate(client.plannedEndDate);
      return today >= start && (!end || (end >= start && today <= end));
    }

    function updateOperationalCalculations() {
      const client = {
        startDate: form.elements.startDate.value,
        actualEndDate: form.elements.actualEndDate.value,
        plannedEndDate: form.elements.plannedEndDate.value
      };
      document.querySelector("#duration").value = getWorkDuration(client);
      document.querySelector("#plannedDurationMonths").value = getPlannedDuration(client);
      const active = isClientActive(client);
      document.querySelector("#activeClient").checked = active;
      document.querySelector("#activeClientLabel").textContent = active ? "Ativo" : "";
    }

    function updateWorkingDaysLabel() {
      const selectedDays = [...form.querySelectorAll('input[name="workingDays"]:checked')].map((input) => input.value);
      document.querySelector("#working-days-label").textContent = selectedDays.length
        ? selectedDays.map((day) => day.charAt(0).toLocaleUpperCase("pt-BR") + day.slice(1)).join(", ")
        : "Selecione os dias";
    }

    function saveClients() {
      // Grava a lista atual no armazenamento local do navegador.
      localStorage.setItem(storageKey, JSON.stringify(clients));
    }

    function openDocumentationDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(documentationDatabaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(documentationStoreName, { keyPath: "key" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function loadDocumentationFiles() {
      const database = await openDocumentationDatabase();
      return new Promise((resolve, reject) => {
        const request = database.transaction(documentationStoreName, "readonly").objectStore(documentationStoreName).getAll();
        request.onsuccess = () => {
          documentationFiles = new Map(request.result.map((file) => [file.key, file]));
          database.close();
          resolve();
        };
        request.onerror = () => {
          database.close();
          reject(request.error);
        };
      });
    }

    async function saveDocumentationFile(client, type, file) {
      const database = await openDocumentationDatabase();
      const record = { key: `${client.id}:${type}`, clientId: client.id, type, name: file.name, blob: file, updatedAt: Date.now() };
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(documentationStoreName, "readwrite");
        transaction.objectStore(documentationStoreName).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      documentationFiles.set(record.key, record);
    }

    async function removeDocumentationFile(key) {
      const database = await openDocumentationDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(documentationStoreName, "readwrite");
        transaction.objectStore(documentationStoreName).delete(key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      documentationFiles.delete(key);
    }

    function downloadDocumentationFile(key) {
      const file = documentationFiles.get(key);
      if (!file) return;
      const downloadUrl = URL.createObjectURL(file.blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = file.name;
      downloadLink.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    function getStatusClass(status) {
      if (status.startsWith("🟢")) return "status-completed";
      if (status.startsWith("🔴")) return "status-pending";
      if (status.startsWith("🟡")) return "status-pending-registration";
      return {
        "Não iniciada": "status-pending",
        "Em andamento": "status-pending-contract",
        "Concluída": "status-completed",
        "Pendente": "status-pending",
        "Pendente em Contrato": "status-pending-contract",
        "Pendente em contrato e Ficha Cadastral": "status-pending-registration",
        "Pendente em Proposta e Contrato": "status-pending-proposal",
        "Completa": "status-completed"
      }[status];
    }

    function renderDocumentationCell(client, type, label) {
      const key = `${client.id}:${type}`;
      const file = documentationFiles.get(key);
      return `<td class="document-cell">
        <div class="document-cell-content">
          ${file ? `<button class="document-file-name" type="button" data-file-action="download" data-file-key="${escapeHtml(key)}" title="Baixar ${escapeHtml(file.name)}">${escapeHtml(file.name)}</button>` : '<span class="document-empty">Sem arquivo</span>'}
          <div class="document-actions">
            <label class="document-upload" title="Anexar ${label}" aria-label="Anexar ${label} para ${escapeHtml(client.company)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M5 14v5h14v-5"/></svg>
              <input class="document-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png" data-client-id="${escapeHtml(client.id)}" data-document-type="${type}" aria-label="Anexar ${label} para ${escapeHtml(client.company)}">
            </label>
            ${file ? `<button class="icon-button document-remove" type="button" data-file-action="remove" data-file-key="${escapeHtml(key)}" aria-label="Remover ${label} de ${escapeHtml(client.company)}" title="Remover anexo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>` : ""}
          </div>
        </div>
      </td>`;
    }

    function renderDocumentationClient(client) {
      return `<tr>
        <td><span class="primary-cell">${escapeHtml(client.company)}</span><span class="secondary-cell">${escapeHtml(client.project)}</span></td>
        <td><span class="status-badge ${getStatusClass(getDocumentationStatus(client))}">${escapeHtml(getDocumentationStatus(client))}</span></td>
        ${renderDocumentationCell(client, "proposal", "Proposta")}
        ${renderDocumentationCell(client, "contract", "Contrato")}
        ${renderDocumentationCell(client, "registration", "Ficha Cadastral")}
        <td>${escapeHtml(getWorkDuration(client))}</td>
      </tr>`;
    }

    function render() {
      // Atualiza contadores, filtros e linhas conforme a busca e o status selecionado.
      const query = search.value.trim().toLocaleLowerCase("pt-BR");
      const queryDigits = query.replace(/\D/g, "");
      const searched = clients.filter((client) => {
        const searchableFields = isDocumentationArea
          ? [client.company, client.project, client.duration, getDocumentationStatus(client)]
          : Object.values(client);
        const matchesText = searchableFields.some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
        const matchesCnpj = !isDocumentationArea && queryDigits.length > 0 && normalizeCnpj(client.cnpj).includes(queryDigits);
        return matchesText || matchesCnpj;
      });
      const allStatusesLabel = getStatusLabel();
      const getStatusForArea = isDocumentationArea ? getDocumentationStatus : getWorkStatus;
      const filtered = searched.filter((client) => activeStatus === allStatusesLabel || getStatusForArea(client) === activeStatus);
      document.querySelector("#status-current-label").textContent = activeStatus;
      const selectedCount = activeStatus === allStatusesLabel ? searched.length : searched.filter((client) => getStatusForArea(client) === activeStatus).length;
      document.querySelector("#selected-status-count").textContent = selectedCount;
      document.querySelectorAll(".status-menu-item").forEach((button) => {
        const status = button.dataset.status;
        const count = status === allStatusesLabel ? searched.length : searched.filter((client) => getStatusForArea(client) === status).length;
        button.querySelector(".status-count").textContent = count;
        button.setAttribute("aria-checked", String(activeStatus === status));
      });
      rows.innerHTML = filtered.map((client) => {
        if (isDocumentationArea) return renderDocumentationClient(client);
        const status = getWorkStatus(client);
        return `
        <tr>
          <td><span class="primary-cell">${escapeHtml(client.company)}</span><span class="secondary-cell">${escapeHtml(client.project)}</span></td>
          <td><span class="primary-cell">${escapeHtml(client.legalName)}</span><span class="secondary-cell">${escapeHtml(client.cnpj)}</span></td>
          <td>${escapeHtml(client.address)}</td>
          <td>${escapeHtml(getWorkDuration(client))}</td>
          <td>${escapeHtml(formatClientDate(client.startDate))}</td>
          <td>${escapeHtml(formatClientDate(client.actualEndDate || client.plannedEndDate))}</td>
          <td><span class="status-badge ${getStatusClass(status)}">${escapeHtml(status)}</span></td>
          <td class="action-cell"><button class="icon-button edit-client" type="button" data-id="${escapeHtml(client.id)}" aria-label="Editar ${escapeHtml(client.company)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></svg></button></td>
        </tr>`;
      }).join("");
      emptyState.hidden = filtered.length > 0;
      document.querySelector("#table-footer").hidden = clients.length === 0;
      if (clients.length > 0 && filtered.length === 0) {
        document.querySelector("#empty-title").textContent = query ? "Nenhum resultado encontrado" : `Nenhum ${isDocumentationArea ? "registro" : "cliente"} em ${activeStatus}`;
        document.querySelector("#empty-description").textContent = query ? "Tente buscar por outro nome, obra ou CNPJ." : "Escolha outro status ou cadastre um cliente nesta categoria.";
        document.querySelector("#empty-add").hidden = true;
      } else {
        document.querySelector("#empty-title").textContent = isDocumentationArea ? "Nenhum cliente na Rede de Clientes" : "Nenhum cliente cadastrado";
        document.querySelector("#empty-description").textContent = isDocumentationArea ? "Cadastre o cliente na Rede de Clientes para anexar documentos." : "Cadastre uma construtora e sua primeira obra para começar.";
        document.querySelector("#empty-add").hidden = isDocumentationArea;
      }
    }

    function showToast(message) {
      const toast = document.querySelector("#toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    }

    function closeDialog() {
      if (!dialog.open) return;
      dialog.close();
    }

    async function openForm(client = null) {
      // Preenche o formulario para edicao ou prepara um novo cadastro.
      if (dialog.open) return;
      await documentationFilesReady;
      editingId = client?.id ?? null;
      pendingCommercialFiles.clear();
      form.reset();
      form.querySelectorAll(".form-section").forEach((section, index) => {
        section.open = index === 0;
      });
      document.querySelector(".multi-select").open = false;
      updateWorkingDaysLabel();
      document.querySelector("#dialog-title").textContent = client ? `Editar ${isDocumentationArea ? "registro" : "cliente"}` : isDocumentationArea ? "Novo registro" : "Novo cliente";
      document.querySelector("#save-client").textContent = client ? "Salvar alterações" : isDocumentationArea ? "Salvar registro" : "Salvar cliente";
      document.querySelector("#delete-client").hidden = !client;
      document.querySelector("#delete-client").textContent = isDocumentationArea ? "Excluir registro" : "Excluir cliente";
      if (client) {
        for (const field of ["company", "project", "address", "legalName", "cnpj", "invoiceDueDate", "workStartTime", "workEndTime", "plannedStartDate", "startDate", "plannedEndDate", "actualEndDate", "quantityOnSite", "recessKit", "workSystem", "approvalDeadline", "tstPhone", "tstEmail", "proposalDate", "proposalStatus"]) form.elements[field].value = client[field] || "";
        form.elements.workStatus.value = getWorkStatus(client);
        form.elements.installation.checked = Boolean(client.installation);
        form.elements.inspection.checked = Boolean(client.inspection);
        const workingDays = Array.isArray(client.workingDays) ? client.workingDays : [];
        form.querySelectorAll('input[name="workingDays"]').forEach((input) => {
          input.checked = workingDays.includes(input.value);
        });
        updateWorkingDaysLabel();
      }
      updateOperationalCalculations();
      updateCommercialDocumentFields(client?.id);
      dialog.showModal();
      form.elements.company.focus();
    }

    document.querySelector("#add-client").addEventListener("click", () => openForm());
    
      // Conecta os botoes, a busca, os filtros e o campo formatado de CNPJ.
    document.querySelector("#empty-add").addEventListener("click", () => openForm());
    document.querySelector("#cancel-dialog").addEventListener("click", () => closeDialog());
    document.querySelector("#close-dialog").addEventListener("click", () => closeDialog());
    form.addEventListener("invalid", (event) => {
      event.target.closest(".form-section")?.setAttribute("open", "");
    }, true);
    form.addEventListener("input", updateOperationalCalculations);
    form.addEventListener("change", updateOperationalCalculations);
    form.addEventListener("click", (event) => {
      const button = event.target.closest('[data-file-action="download"]');
      if (button) downloadDocumentationFile(button.dataset.fileKey);
    });
    form.addEventListener("change", (event) => {
      const input = event.target.closest(".commercial-file-input");
      const file = input?.files?.[0];
      if (!input || !file) return;
      pendingCommercialFiles.set(input.dataset.documentType, file);
      updateCommercialDocumentFields(editingId);
    });
    form.querySelectorAll('input[name="workingDays"]').forEach((input) => {
      input.addEventListener("change", updateWorkingDaysLabel);
    });
    form.querySelectorAll(".form-section").forEach((section) => {
      section.addEventListener("toggle", () => {
        if (!section.open) return;
        form.querySelectorAll(".form-section").forEach((otherSection) => {
          if (otherSection !== section) otherSection.open = false;
        });
      });
    });
    dialog.addEventListener("close", () => {
      form.querySelectorAll(".form-section").forEach((section) => {
        section.open = false;
      });
      document.querySelector("#commercial-dropdown").open = false;
    });
    search.addEventListener("input", render);
    statusMenuToggle.addEventListener("click", () => {
      const isOpen = statusMenuToggle.getAttribute("aria-expanded") === "true";
      statusMenu.hidden = isOpen;
      statusMenuToggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) (statusMenu.querySelector(`[data-status="${activeStatus}"]`) || statusMenu.querySelector(".status-menu-item"))?.focus();
    });
    statusMenu.addEventListener("click", (event) => {
      const button = event.target.closest(".status-menu-item");
      if (!button) return;
      activeStatus = button.dataset.status === activeStatus ? getStatusLabel() : button.dataset.status;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
      statusMenuToggle.focus();
      render();
    });
    document.addEventListener("click", (event) => {
      if (statusDropdown.contains(event.target)) return;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || statusMenu.hidden) return;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
      statusMenuToggle.focus();
    });
    rows.addEventListener("click", (event) => {
      const button = event.target.closest(".edit-client");
      if (!button) return;
      const client = clients.find((item) => item.id === button.dataset.id);
      if (client) openForm(client);
    });
    rows.addEventListener("change", async (event) => {
      const input = event.target.closest(".document-file-input");
      const file = input?.files?.[0];
      const client = clients.find((item) => item.id === input?.dataset.clientId);
      if (!isDocumentationArea || !file || !client) return;
      try {
        await saveDocumentationFile(client, input.dataset.documentType, file);
        render();
        showToast("Arquivo anexado.");
      } catch (error) {
        console.error("Não foi possível salvar o arquivo.", error);
        showToast("Não foi possível salvar o arquivo neste navegador.");
      }
    });
    rows.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-file-action]");
      if (!button) return;
      const file = documentationFiles.get(button.dataset.fileKey);
      if (!file) return;
      if (button.dataset.fileAction === "remove") {
        if (!isDocumentationArea) return;
        if (!confirm(`Remover o arquivo ${file.name}?`)) return;
        try {
          await removeDocumentationFile(file.key);
          render();
          showToast("Arquivo removido.");
        } catch (error) {
          console.error("Não foi possível remover o arquivo.", error);
          showToast("Não foi possível remover o arquivo.");
        }
        return;
      }
      downloadDocumentationFile(button.dataset.fileKey);
    });
    document.querySelector("#cnpj").addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
      event.target.value = digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    });

    form.addEventListener("submit", async (event) => {

      // Valida e salva o cadastro, impedindo CNPJs duplicados.
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.workingDays = formData.getAll("workingDays");
      data.installation = form.elements.installation.checked;
      data.inspection = form.elements.inspection.checked;
      const cnpjDigits = normalizeCnpj(data.cnpj);
      const duplicate = cnpjDigits.length > 0 && clients.some((client) => {
        const clientCnpj = normalizeCnpj(client.cnpj);
        return clientCnpj && clientCnpj === cnpjDigits && client.id !== editingId;
      });
      if (duplicate) {
        form.elements.cnpj.setCustomValidity("Este CNPJ já está cadastrado.");
        form.elements.cnpj.reportValidity();
        form.elements.cnpj.addEventListener("input", () => form.elements.cnpj.setCustomValidity(""), { once: true });
        return;
      }
      const wasEditing = Boolean(editingId);
      const clientId = editingId || crypto.randomUUID();
      const clientData = { id: clientId, ...data };
      const previousClients = clients;
      if (wasEditing) {
        clients = clients.map((client) => client.id === editingId ? clientData : client);
      } else {
        clients.unshift(clientData);
      }
      const saveButton = document.querySelector("#save-client");
      saveButton.disabled = true;
      try {
        saveClients();
      } catch (error) {
        clients = previousClients;
        console.error("Não foi possível salvar o cadastro.", error);
        showToast("Não foi possível salvar o cadastro neste navegador.");
        saveButton.disabled = false;
        return;
      }

      editingId = clientId;
      const failedUploads = [];
      for (const [type, file] of pendingCommercialFiles) {
        try {
          await saveDocumentationFile(clientData, type, file);
          pendingCommercialFiles.delete(type);
        } catch (error) {
          console.error(`Não foi possível salvar o documento ${file.name}.`, error);
          failedUploads.push(file.name);
        }
      }
      render();
      updateCommercialDocumentFields(clientId);
      saveButton.disabled = false;
      if (failedUploads.length) {
        document.querySelector("#dialog-title").textContent = `Editar cliente`;
        saveButton.textContent = "Salvar alterações";
        document.querySelector("#delete-client").hidden = false;
        document.querySelector("#delete-client").textContent = "Excluir cliente";
        showToast("Cadastro salvo, mas não foi possível anexar: " + failedUploads.join(", "));
        return;
      }
      pendingCommercialFiles.clear();
      closeDialog();
      showToast(wasEditing ? "Cadastro atualizado." : isDocumentationArea ? "Registro cadastrado." : "Cliente cadastrado.");
    });

    if (isSettingsArea) {
      document.querySelector("#theme-preference").addEventListener("change", (event) => {
        preferences.theme = event.target.value;
        savePreferences();
      });
      document.querySelector("#language-preference").addEventListener("change", (event) => {
        preferences.language = event.target.value;
        savePreferences();
      });
      document.querySelector("#timezone-preference").addEventListener("change", (event) => {
        preferences.timezone = event.target.value;
        savePreferences();
      });
    }

    if (isPersonnelArea) {
      const employeeDialog = document.querySelector("#employee-dialog");
      const employeeForm = document.querySelector("#employee-form");
      const employeePhotoInput = document.querySelector("#employee-photo");
      const employeeBankSelect = document.querySelector("#employee-bank");
      const employeeBankAddRow = document.querySelector("#employee-bank-add-row");
      const employeeNewBankInput = document.querySelector("#employee-new-bank");
      renderEmployeeBankOptions();
      const openEmployeeForm = async (employee = null) => {
        await documentationFilesReady;
        editingEmployeeId = employee?.id ?? null;
        employeeForm.querySelectorAll(".legacy-option").forEach((option) => option.remove());
        employeeForm.reset();
        employeeBankAddRow.hidden = true;
        employeeNewBankInput.value = "";
        renderEmployeeBankOptions(employee?.bank || "");
        document.querySelector("#employee-form-feedback").textContent = "";
        employeePhotoInput.setCustomValidity("");
        document.querySelector("#employee-dialog-title").textContent = employee ? "Editar colaborador" : "Novo colaborador";
        if (employee) {
          ["name", "cpf", "birthDate", "address", "email", "pix", "pixType", "bank", "bankBranch", "bankAccount", "department", "registrationNumber", "admissionDate", "pantsSize", "shirtSize", "shoeSize", "baseSalary", "pis"].forEach((field) => {
            employeeForm.elements.namedItem(field).value = employee[field] || "";
          });
          ["jobFunction", "contract", "pixType"].forEach((field) => {
            const select = employeeForm.elements.namedItem(field);
            const selectedValue = field === "contract" ? employee.contract || "" : field === "jobFunction" ? employee.jobFunction || "" : employee.pixType || "";
            if (selectedValue && ![...select.options].some((option) => option.value === selectedValue)) {
              const legacyOption = new Option(selectedValue, selectedValue);
              legacyOption.className = "legacy-option";
              select.add(legacyOption);
            }
            select.value = selectedValue;
          });
          employeeForm.elements.namedItem("active").value = String(employee.active);
        }
        updateEmployeeComputedFields();
        updateEmployeePhotoPreview();
        employeeDialog.showModal();
        employeeForm.elements.namedItem("name").focus();
      };

      document.querySelector("#add-employee").addEventListener("click", () => openEmployeeForm());
      employeeForm.addEventListener("input", updateEmployeeComputedFields);
      employeeForm.addEventListener("change", updateEmployeeComputedFields);
      document.querySelector("#employee-add-bank").addEventListener("click", () => {
        employeeBankAddRow.hidden = false;
        employeeNewBankInput.focus();
      });
      document.querySelector("#employee-cancel-bank").addEventListener("click", () => {
        employeeNewBankInput.value = "";
        employeeBankAddRow.hidden = true;
      });
      const saveEmployeeBank = () => {
        const bankName = employeeNewBankInput.value.trim();
        if (!bankName) {
          employeeNewBankInput.setCustomValidity("Digite o nome do banco.");
          employeeNewBankInput.reportValidity();
          employeeNewBankInput.setCustomValidity("");
          return;
        }
        const existingBank = employeeBanks.find((bank) => bank.toLocaleLowerCase("pt-BR") === bankName.toLocaleLowerCase("pt-BR"));
        if (existingBank) {
          renderEmployeeBankOptions(existingBank);
          employeeBankAddRow.hidden = true;
          employeeNewBankInput.value = "";
          return;
        }
        const updatedBanks = [...employeeBanks, bankName];
        try {
          localStorage.setItem(employeeBanksStorageKey, JSON.stringify(updatedBanks));
        } catch (error) {
          console.error("Não foi possível adicionar o banco.", error);
          document.querySelector("#employee-form-feedback").textContent = "Não foi possível salvar a lista de bancos neste dispositivo.";
          return;
        }
        employeeBanks = updatedBanks;
        renderEmployeeBankOptions(bankName);
        employeeBankAddRow.hidden = true;
        employeeNewBankInput.value = "";
        document.querySelector("#employee-form-feedback").textContent = "";
      };
      document.querySelector("#employee-save-bank").addEventListener("click", saveEmployeeBank);
      employeeNewBankInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveEmployeeBank();
        } else if (event.key === "Escape") {
          employeeNewBankInput.value = "";
          employeeBankAddRow.hidden = true;
        }
      });
      const employeeContractDropdown = document.querySelector("#employee-contract-dropdown");
      const employeeContractToggle = document.querySelector("#employee-contract-toggle");
      const employeeContractMenu = document.querySelector("#employee-contract-menu");
      employeeContractToggle.addEventListener("click", () => {
        const isOpen = employeeContractMenu.hidden;
        employeeContractMenu.hidden = !isOpen;
        employeeContractToggle.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) (employeeContractMenu.querySelector('[aria-checked="true"]') || employeeContractMenu.querySelector(".status-menu-item"))?.focus();
      });
      employeeContractMenu.addEventListener("click", (event) => {
        const option = event.target.closest("[data-contract]");
        if (!option) return;
        activeContractFilter = option.dataset.contract;
        employeeContractMenu.hidden = true;
        employeeContractToggle.setAttribute("aria-expanded", "false");
        renderEmployees();
        employeeContractToggle.focus();
      });
      employeeContractMenu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        employeeContractMenu.hidden = true;
        employeeContractToggle.setAttribute("aria-expanded", "false");
        employeeContractToggle.focus();
      });
      document.addEventListener("click", (event) => {
        if (!employeeContractDropdown.contains(event.target)) {
          employeeContractMenu.hidden = true;
          employeeContractToggle.setAttribute("aria-expanded", "false");
        }
      });
      employeePhotoInput.addEventListener("change", () => {
        const file = employeePhotoInput.files[0];
        if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
          employeePhotoInput.setCustomValidity("Selecione uma imagem de até 10 MB.");
          employeePhotoInput.reportValidity();
          employeePhotoInput.setCustomValidity("");
          employeePhotoInput.value = "";
          return;
        }
        employeePhotoInput.setCustomValidity("");
        updateEmployeePhotoPreview(file);
      });
      document.querySelector("#close-employee-dialog").addEventListener("click", () => employeeDialog.close());
      document.querySelector("#cancel-employee-dialog").addEventListener("click", () => employeeDialog.close());
      employeeDialog.addEventListener("close", () => {
        if (employeePhotoPreviewUrl) URL.revokeObjectURL(employeePhotoPreviewUrl);
        employeePhotoPreviewUrl = null;
      });
      document.querySelectorAll(".employee-tab").forEach((button) => {
        button.addEventListener("click", () => {
          activeEmployeeView = button.dataset.employeeView;
          document.querySelectorAll(".employee-tab").forEach((tab) => {
            const selected = tab === button;
            tab.classList.toggle("active", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
          employeeContractMenu.hidden = true;
          employeeContractToggle.setAttribute("aria-expanded", "false");
          renderEmployees();
        });
      });
      document.querySelector("#employee-grid").addEventListener("click", (event) => {
        const button = event.target.closest(".employee-edit");
        if (!button) return;
        const employee = employees.find((item) => item.id === button.dataset.employeeId);
        if (employee) openEmployeeForm(employee);
      });
      employeeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!employeeForm.reportValidity()) return;
        const data = Object.fromEntries(new FormData(employeeForm).entries());
        data.active = data.active === "true";
        const employee = { id: editingEmployeeId || crypto.randomUUID(), ...data };
        const photo = employeePhotoInput.files[0];
        const previousEmployees = employees;
        employees = editingEmployeeId
          ? employees.map((item) => item.id === editingEmployeeId ? employee : item)
          : [...employees, employee];
        try {
          saveEmployees();
          if (photo) await saveEmployeePhoto(employee.id, photo);
        } catch (error) {
          employees = previousEmployees;
          try {
            saveEmployees();
          } catch (rollbackError) {
            console.error("Não foi possível restaurar os dados anteriores dos colaboradores.", rollbackError);
          }
          console.error(photo ? "Não foi possível salvar os dados e a foto do colaborador." : "Não foi possível salvar o colaborador.", error);
          document.querySelector("#employee-form-feedback").textContent = "Não foi possível salvar os dados do colaborador neste dispositivo.";
          return;
        }
        renderEmployees();
        employeeDialog.close();
      });
      employeeDialog.addEventListener("click", (event) => {
        if (event.target === employeeDialog) employeeDialog.close();
      });
    }

    if (isSupplierArea) {
      const supplierDialog = document.querySelector("#supplier-dialog");
      const supplierForm = document.querySelector("#supplier-form");
      const supplierPhotoInput = document.querySelector("#supplier-photo");
      const supplierPhotoPreview = document.querySelector("#supplier-photo-preview");
      const supplierPhotoEmpty = document.querySelector("#supplier-photo-empty");
      const supplierPhotoFilename = document.querySelector("#supplier-photo-filename");

      const updateSupplierPhotoPreview = (file = null) => {
        if (supplierPhotoPreviewUrl) URL.revokeObjectURL(supplierPhotoPreviewUrl);
        supplierPhotoPreviewUrl = file ? URL.createObjectURL(file) : null;
        const savedPhoto = editingSupplierId && documentationFiles.get(`supplier:${editingSupplierId}:photo`);
        const photoUrl = supplierPhotoPreviewUrl || (savedPhoto && getSupplierPhotoUrl(editingSupplierId));
        supplierPhotoPreview.hidden = !photoUrl;
        supplierPhotoPreview.removeAttribute("src");
        if (photoUrl) supplierPhotoPreview.src = photoUrl;
        supplierPhotoEmpty.hidden = Boolean(photoUrl);
        supplierPhotoFilename.textContent = file?.name || savedPhoto?.name || "Imagem opcional, até 10 MB";
      };

      const openSupplierForm = async (supplier = null) => {
        await documentationFilesReady;
        editingSupplierId = supplier?.id || null;
        supplierForm.reset();
        document.querySelector("#supplier-form-feedback").textContent = "";
        document.querySelector("#supplier-dialog-title").textContent = supplier ? "Editar fornecedor" : "Novo fornecedor";
        if (supplier) {
          ["name", "category", "contact", "phone", "email", "notes"].forEach((field) => {
            supplierForm.elements.namedItem(field).value = supplier[field] || "";
          });
        }
        updateSupplierPhotoPreview();
        supplierDialog.showModal();
        supplierForm.elements.namedItem("name").focus();
      };

      renderSuppliers();
      document.querySelector("#add-finance-record").addEventListener("click", () => openSupplierForm());
      document.querySelector("#supplier-search").addEventListener("input", renderSuppliers);
      document.querySelector("#supplier-grid").addEventListener("click", (event) => {
        const button = event.target.closest("[data-edit-supplier]");
        const supplier = suppliers.find((item) => item.id === button?.dataset.editSupplier);
        if (supplier) openSupplierForm(supplier);
      });
      supplierPhotoInput.addEventListener("change", () => {
        const file = supplierPhotoInput.files[0];
        if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
          supplierPhotoInput.setCustomValidity("Selecione uma imagem de até 10 MB.");
          supplierPhotoInput.reportValidity();
          supplierPhotoInput.setCustomValidity("");
          supplierPhotoInput.value = "";
          return;
        }
        updateSupplierPhotoPreview(file);
      });
      document.querySelector("#close-supplier-dialog").addEventListener("click", () => supplierDialog.close());
      document.querySelector("#cancel-supplier-dialog").addEventListener("click", () => supplierDialog.close());
      supplierDialog.addEventListener("close", () => {
        if (supplierPhotoPreviewUrl) URL.revokeObjectURL(supplierPhotoPreviewUrl);
        supplierPhotoPreviewUrl = null;
      });
      supplierDialog.addEventListener("click", (event) => {
        if (event.target === supplierDialog) supplierDialog.close();
      });
      supplierForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!supplierForm.reportValidity()) return;
        const data = Object.fromEntries(new FormData(supplierForm).entries());
        const photo = supplierPhotoInput.files[0];
        const previousSuppliers = suppliers;
        const supplier = { id: editingSupplierId || crypto.randomUUID(), ...data };
        suppliers = editingSupplierId
          ? suppliers.map((item) => item.id === editingSupplierId ? supplier : item)
          : [...suppliers, supplier];
        try {
          saveFinanceRecords(suppliersStorageKey, suppliers);
          if (photo) await saveFinanceFile(`supplier:${supplier.id}:photo`, supplier.id, "supplier-photo", photo);
        } catch (error) {
          suppliers = previousSuppliers;
          try {
            saveFinanceRecords(suppliersStorageKey, suppliers);
          } catch (rollbackError) {
            console.error("Não foi possível restaurar a lista anterior de fornecedores.", rollbackError);
          }
          console.error("Não foi possível salvar o fornecedor.", error);
          document.querySelector("#supplier-form-feedback").textContent = "Não foi possível salvar o fornecedor neste dispositivo.";
          return;
        }
        renderSuppliers();
        supplierDialog.close();
      });
    }

    if (isBillsArea) {
      const billDialog = document.querySelector("#bill-dialog");
      const billForm = document.querySelector("#bill-form");
      const billDocumentInput = document.querySelector("#bill-document");
      const billReceiptInput = document.querySelector("#bill-receipt");
      const billSupplierSelect = document.querySelector("#bill-supplier");
      const billTableScroll = document.querySelector("#bill-table-scroll");
      const billHorizontalScroll = document.querySelector("#bill-horizontal-scroll");
      const billViewDropdown = document.querySelector("#bill-view-dropdown");
      const billViewToggle = document.querySelector("#bill-view-toggle");
      const billViewMenu = document.querySelector("#bill-view-menu");

      billTableScroll.addEventListener("scroll", () => {
        billHorizontalScroll.scrollLeft = billTableScroll.scrollLeft;
      });
      billHorizontalScroll.addEventListener("scroll", () => {
        billTableScroll.scrollLeft = billHorizontalScroll.scrollLeft;
      });
      window.addEventListener("resize", updateBillHorizontalScroll);

      const renderBillSupplierOptions = (selectedId = "") => {
        billSupplierSelect.innerHTML = '<option value="">Selecione um fornecedor</option>' + suppliers
          .map((supplier) => `<option value="${escapeHtml(supplier.id)}">${escapeHtml(supplier.name)}</option>`).join("");
        billSupplierSelect.value = selectedId;
        billSupplierSelect.required = suppliers.length > 0;
      };

      const openBillForm = (bill = null) => {
        suppliers = loadFinanceRecords(suppliersStorageKey);
        editingBillId = bill?.id || null;
        billForm.reset();
        document.querySelector("#bill-form-feedback").textContent = "";
        document.querySelector("#bill-dialog-title").textContent = bill ? "Editar boleto" : "Novo boleto";
        renderBillSupplierOptions(bill?.supplierId || "");
        if (bill) {
          ["number", "value", "dueDate", "advancePaymentDate", "paymentDate", "fees", "kind", "details", "method", "bank", "installment", "responsible", "creditType"].forEach((field) => {
            billForm.elements.namedItem(field).value = bill[field] || "";
          });
        } else if (activeBillView === "credit") {
          billForm.elements.namedItem("kind").value = "credit";
        }
        const savedDocument = editingBillId && documentationFiles.get(`bill:${editingBillId}:document`);
        const savedReceipt = editingBillId && documentationFiles.get(`bill:${editingBillId}:receipt`);
        billDocumentInput.title = savedDocument?.name || "";
        billReceiptInput.title = savedReceipt?.name || "";
        if (savedReceipt && !billForm.elements.namedItem("paymentDate").value) {
          billForm.elements.namedItem("paymentDate").value = getTodayInputDate();
        }
        billDialog.showModal();
        billForm.elements.namedItem("number").focus();
      };

      renderBillSupplierOptions();
      renderBills();
      billViewToggle.addEventListener("click", () => {
        const isOpen = billViewToggle.getAttribute("aria-expanded") === "true";
        billViewMenu.hidden = isOpen;
        billViewToggle.setAttribute("aria-expanded", String(!isOpen));
        if (!isOpen) billViewMenu.querySelector(`[data-bill-view="${activeBillView}"]`)?.focus();
      });
      billViewMenu.addEventListener("click", (event) => {
        const option = event.target.closest("[data-bill-view]");
        if (!option) return;
        activeBillView = option.dataset.billView;
        billViewMenu.hidden = true;
        billViewToggle.setAttribute("aria-expanded", "false");
        renderBills();
        billViewToggle.focus();
      });
      document.addEventListener("click", (event) => {
        if (billViewDropdown.contains(event.target)) return;
        billViewMenu.hidden = true;
        billViewToggle.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || billViewMenu.hidden) return;
        billViewMenu.hidden = true;
        billViewToggle.setAttribute("aria-expanded", "false");
        billViewToggle.focus();
      });
      window.addEventListener("storage", (event) => {
        if (event.key !== suppliersStorageKey) return;
        suppliers = loadFinanceRecords(suppliersStorageKey);
        renderBillSupplierOptions(billSupplierSelect.value);
        renderBills();
      });
      document.querySelector("#add-finance-record").addEventListener("click", () => openBillForm());
      document.querySelector("#bill-search").addEventListener("input", renderBills);
      billReceiptInput.addEventListener("change", () => {
        const paymentDateInput = billForm.elements.namedItem("paymentDate");
        if (billReceiptInput.files.length && !paymentDateInput.value) {
          paymentDateInput.value = getTodayInputDate();
        }
      });
      document.querySelector("#bill-rows").addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-edit-bill]");
        if (editButton) {
          const bill = bills.find((item) => item.id === editButton.dataset.editBill);
          if (bill) openBillForm(bill);
          return;
        }
        const deleteButton = event.target.closest("[data-delete-bill]");
        if (deleteButton) {
          bills = bills.filter((item) => item.id !== deleteButton.dataset.deleteBill);
          try {
            saveFinanceRecords(billsStorageKey, bills);
            renderBills();
          } catch (error) {
            console.error("Não foi possível excluir o boleto.", error);
            document.querySelector("#bill-feedback").textContent = "Não foi possível excluir o boleto neste dispositivo.";
          }
          return;
        }
        const downloadButton = event.target.closest('[data-file-action="download"]');
        if (downloadButton) downloadDocumentationFile(downloadButton.dataset.fileKey);
      });
      document.querySelector("#close-bill-dialog").addEventListener("click", () => billDialog.close());
      document.querySelector("#cancel-bill-dialog").addEventListener("click", () => billDialog.close());
      billDialog.addEventListener("click", (event) => {
        if (event.target === billDialog) billDialog.close();
      });
      billForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!billForm.reportValidity()) return;
        const data = Object.fromEntries(new FormData(billForm).entries());
        delete data.document;
        delete data.receipt;
        data.supplierName = suppliers.find((supplier) => supplier.id === data.supplierId)?.name || "";
        const attachedFile = billDocumentInput.files[0];
        const receiptFile = billReceiptInput.files[0];
        const savedReceipt = editingBillId && documentationFiles.has(`bill:${editingBillId}:receipt`);
        if ((receiptFile || savedReceipt) && !data.paymentDate) {
          data.paymentDate = getTodayInputDate();
        }
        const previousBills = bills;
        const bill = { id: editingBillId || crypto.randomUUID(), ...data };
        bills = editingBillId
          ? bills.map((item) => item.id === editingBillId ? bill : item)
          : [...bills, bill];
        try {
          saveFinanceRecords(billsStorageKey, bills);
          if (attachedFile) await saveFinanceFile(`bill:${bill.id}:document`, bill.id, "bill-document", attachedFile);
          if (receiptFile) await saveFinanceFile(`bill:${bill.id}:receipt`, bill.id, "bill-receipt", receiptFile);
        } catch (error) {
          bills = previousBills;
          try {
            saveFinanceRecords(billsStorageKey, bills);
          } catch (rollbackError) {
            console.error("Não foi possível restaurar a lista anterior de boletos.", rollbackError);
          }
          console.error("Não foi possível salvar o boleto.", error);
          document.querySelector("#bill-form-feedback").textContent = "Não foi possível salvar o boleto neste dispositivo.";
          return;
        }
        renderBills();
        billDialog.close();
      });
    }

    document.querySelector("#delete-client").addEventListener("click", () => {
      // Exclui somente depois da confirmacao do usuario.
      const client = clients.find((item) => item.id === editingId);
      if (!client || !confirm(`Excluir o cadastro de ${client.company}?`)) return;
      clients = clients.filter((item) => item.id !== editingId);
      saveClients();
      render();
      closeDialog();
      showToast(isDocumentationArea ? "Registro excluído." : "Cliente excluído.");
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });

    render();
    documentationFilesReady = loadDocumentationFiles().then(() => {
      render();
      if (isPersonnelArea) renderEmployees();
      if (isSupplierArea) renderSuppliers();
      if (isBillsArea) renderBills();
      if (dialog.open) updateCommercialDocumentFields(editingId);
    }).catch((error) => {
      console.error("Não foi possível carregar os anexos.", error);
      showToast("Não foi possível carregar os anexos neste navegador.");
    });