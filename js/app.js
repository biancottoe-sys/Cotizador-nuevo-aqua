(function () {
  "use strict";

  var STORAGE_KEY = "aquaglass_catalog_budget_v3";
  var VAT_RATE = 0.21;
  var state = {
    catalog: window.AQUAGLASS_CATALOG || { products: [], heroImages: [] },
    activeCategory: "Todos",
    query: "",
    selectedProductId: "",
    selectedImageIndex: 0,
    selectedVariants: {},
    items: [],
    project: {},
    quoteNumber: ""
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    migrateOldSavedItems();
    loadSaved();
    bindEvents();
    hydrateProjectForm();
    renderHero();
    renderStats();
    renderCategories();
    renderProducts();
    if (state.selectedProductId) {
      selectProduct(state.selectedProductId, false);
    } else {
      renderProductDetail();
    }
    renderBudget();
    applyRoute();
  }

  function cacheElements() {
    [
      "heroImage", "productCount", "categoryCount", "quoteNumber", "searchInput",
      "categoryTabs", "activeCategoryLabel", "catalogTitle", "resultCount",
      "productGrid", "detailImage", "thumbRow", "detailCategory", "detailTitle",
      "detailDescription", "specList", "quantity", "addBtn", "budgetItems",
      "itemCount", "clientName", "projectName", "contactName", "email",
      "validity", "discount", "applyVat", "observations", "subtotal",
      "discountAmount", "vatAmount", "total", "printBtnSide", "exportBtn",
      "clearBtn", "printDocument", "cartBtn", "cartBadge", "catalogView",
      "cartView", "continueShoppingBtn", "detailSection", "cartToast",
      "variantField", "variantSelect", "variantHelp", "techSheetBtn"
    ].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", function () {
      state.query = els.searchInput.value.trim();
      renderProducts();
      persist();
    });

    els.addBtn.addEventListener("click", addSelectedProduct);
    els.techSheetBtn.addEventListener("click", openTechnicalSheet);
    els.variantSelect.addEventListener("change", function () {
      var product = selectedProduct();
      if (!product) {
        return;
      }
      state.selectedVariants[product.id] = els.variantSelect.value;
      renderVariantSelector(product);
      renderSpecs(product);
      persist();
    });
    els.printBtnSide.addEventListener("click", printBudget);
    els.exportBtn.addEventListener("click", exportJson);
    els.clearBtn.addEventListener("click", clearBudget);
    els.cartBtn.addEventListener("click", function () {
      showCartView();
    });
    els.continueShoppingBtn.addEventListener("click", function () {
      showCatalogView();
    });
    window.addEventListener("hashchange", applyRoute);

    projectInputs().forEach(function (input) {
      input.addEventListener("input", function () {
        readProjectForm();
        renderBudget();
        persist();
      });
      input.addEventListener("change", function () {
        readProjectForm();
        renderBudget();
        persist();
      });
    });
  }

  function renderHero() {
    els.heroImage.src = "assets/catalogo-pdf/catalog-cover.jpg";
  }

  function renderStats() {
    if (els.productCount) {
      els.productCount.textContent = String(state.catalog.products.length);
    }
    if (els.categoryCount) {
      els.categoryCount.textContent = String(categories().filter(function (item) { return item !== "Todos"; }).length);
    }
    if (els.quoteNumber) {
      els.quoteNumber.textContent = state.quoteNumber;
    }
    updateCartBadge();
  }

  function applyRoute() {
    if (window.location.hash === "#carrito" || window.location.hash === "#presupuesto") {
      showCartView(false);
      return;
    }
    showCatalogView(false);
  }

  function showCartView(updateHash) {
    els.catalogView.hidden = true;
    els.cartView.hidden = false;
    if (updateHash !== false) {
      window.location.hash = "carrito";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCatalogView(updateHash) {
    els.catalogView.hidden = false;
    els.cartView.hidden = true;
    if (updateHash !== false) {
      window.location.hash = "catalogo";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateCartBadge() {
    var count = state.items.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
    els.cartBadge.textContent = String(count);
    els.cartBtn.classList.toggle("has-items", count > 0);
  }

  function renderCategories() {
    els.categoryTabs.innerHTML = "";
    categories().forEach(function (category) {
      var count = category === "Todos"
        ? state.catalog.products.length
        : state.catalog.products.filter(function (product) { return product.category === category; }).length;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.classList.toggle("active", state.activeCategory === category);
      button.innerHTML = "<span>" + escapeHtml(category) + "</span><strong>" + count + "</strong>";
      button.addEventListener("click", function () {
        state.activeCategory = category;
        clearProductSelection();
        renderCategories();
        renderProducts();
        persist();
      });
      els.categoryTabs.appendChild(button);
    });
  }

  function renderProducts() {
    var products = filteredProducts();
    els.productGrid.innerHTML = "";
    els.activeCategoryLabel.textContent = state.activeCategory === "Todos" ? "Catálogo completo" : state.activeCategory;
    els.catalogTitle.textContent = state.activeCategory === "Todos" ? "Productos Aquaglass" : state.activeCategory;
    els.resultCount.textContent = products.length + (products.length === 1 ? " producto" : " productos");

    if (!products.length) {
      els.productGrid.innerHTML = '<p class="empty">No hay productos para esa búsqueda.</p>';
      return;
    }

    products.forEach(function (product) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "product-card";
      card.classList.toggle("active", product.id === state.selectedProductId);
      card.innerHTML =
        '<img src="' + escapeAttribute(product.images[0]) + '" alt="' + escapeAttribute(product.name) + '">' +
        '<span class="product-card-body">' +
        '<span class="code-pill">' + escapeHtml(product.code) + '</span>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        '<p>' + escapeHtml(product.category) + ' · ' + escapeHtml(displayMeasureForProduct(product)) + '</p>' +
        '<span class="product-meta"><span>' + escapeHtml(product.material) + '</span><span>' + escapeHtml(product.finish) + '</span></span>' +
        '</span>' +
        '<span class="product-card-footer"><strong class="price">' + escapeHtml(displayPriceLabel(product)) + '</strong><span>Ver ficha</span></span>';
      card.addEventListener("click", function () {
        selectProduct(product.id, true);
      });
      els.productGrid.appendChild(card);
    });
  }

  function selectProduct(productId, shouldScroll) {
    var product = findProduct(productId);
    if (!product) {
      return;
    }
    els.detailSection.hidden = false;
    state.selectedProductId = product.id;
    state.selectedImageIndex = 0;
    renderProductDetail();
    renderProducts();
    persist();
    if (shouldScroll) {
      document.getElementById("productDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderProductDetail() {
    var product = selectedProduct();
    if (!product) {
      renderEmptyProductDetail();
      return;
    }

    els.detailImage.src = product.images[state.selectedImageIndex] || product.images[0];
    els.detailImage.alt = product.name;
    els.detailCategory.textContent = product.category;
    els.detailTitle.textContent = product.name;
    els.detailDescription.textContent = product.description;
    els.thumbRow.innerHTML = "";

    product.images.forEach(function (image, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = index === state.selectedImageIndex ? "active" : "";
      button.innerHTML = '<img src="' + escapeAttribute(image) + '" alt="">';
      button.addEventListener("click", function () {
        state.selectedImageIndex = index;
        renderProductDetail();
      });
      els.thumbRow.appendChild(button);
    });

    renderVariantSelector(product);
    renderSpecs(product);
  }

  function clearProductSelection() {
    state.selectedProductId = "";
    state.selectedImageIndex = 0;
    renderEmptyProductDetail();
  }

  function renderEmptyProductDetail() {
    els.detailSection.hidden = true;
    els.detailImage.removeAttribute("src");
    els.detailImage.alt = "";
    els.detailCategory.textContent = "";
    els.detailTitle.textContent = "";
    els.detailDescription.textContent = "";
    els.thumbRow.innerHTML = "";
    els.specList.innerHTML = "";
    els.variantField.hidden = true;
    els.variantSelect.innerHTML = "";
    els.addBtn.disabled = true;
    els.techSheetBtn.disabled = true;
    return;
    els.detailImage.src = "assets/placeholder-product.jpg";
    els.detailImage.alt = "Producto sin seleccionar";
    els.detailCategory.textContent = "Producto seleccionado";
    els.detailTitle.textContent = "Elegí un producto del catálogo";
    els.detailDescription.textContent = "Seleccioná un producto de la línea actual para ver su ficha, imágenes, precio y datos comerciales.";
    els.thumbRow.innerHTML = "";
    els.specList.innerHTML = [
      ["Estado", "Sin selección"],
      ["Línea", state.activeCategory === "Todos" ? "Catálogo completo" : state.activeCategory],
      ["Precio", "-"],
      ["Código", "-"]
    ].map(function (spec) {
      return "<div><dt>" + escapeHtml(spec[0]) + "</dt><dd>" + escapeHtml(spec[1]) + "</dd></div>";
    }).join("");
    els.addBtn.disabled = true;
  }

  function renderSpecs(product) {
    var variant = selectedVariant(product);
    var displayMeasure = variant ? variant.measure : product.measure;
    var displayPrice = variant ? variant.price : displayPriceForProduct(product);
    var specs = [
      ["Código", product.code],
      ["Precio ficticio", money(displayPrice)],
      ["Línea", product.category],
      ["Medida", displayMeasure],
      ["Material", product.material],
      ["Terminación", product.finish]
    ];
    els.specList.innerHTML = specs.map(function (spec) {
      return "<div><dt>" + escapeHtml(spec[0]) + "</dt><dd>" + escapeHtml(spec[1]) + "</dd></div>";
    }).join("");
    els.addBtn.disabled = hasVariants(product) && !variant;
    els.techSheetBtn.disabled = false;
  }

  function openTechnicalSheet() {
    var product = selectedProduct();
    if (!product) {
      return;
    }
    var html = buildTechnicalSheetHtml(product);
    var sheetWindow = window.open("", "_blank");
    if (sheetWindow) {
      sheetWindow.document.open();
      sheetWindow.document.write(html);
      sheetWindow.document.close();
      return;
    }
    downloadFile("ficha-tecnica-" + slugify(product.name) + ".html", "text/html;charset=utf-8", html);
  }

  function buildTechnicalSheetHtml(product) {
    var variant = selectedVariant(product);
    var measure = variant ? variant.measure : displayMeasureForProduct(product);
    var price = variant ? variant.price : displayPriceForProduct(product);
    var date = new Date().toLocaleDateString("es-AR");
    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Ficha técnica - ' + escapeHtml(product.name) + '</title>' +
      '<style>' +
      'body{margin:0;background:#f2f3f3;color:#111;font-family:Segoe UI,Arial,sans-serif;}' +
      '.sheet{max-width:900px;margin:28px auto;padding:34px;background:#fff;border:1px solid #ddd;}' +
      'header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:24px;}' +
      'h1{margin:0;font-size:30px;} h2{font-size:18px;margin:26px 0 10px;} p{line-height:1.5;color:#555;}' +
      '.code{font-weight:800;border:1px solid #ccc;border-radius:999px;padding:7px 12px;height:max-content;}' +
      '.hero{display:grid;grid-template-columns:260px 1fr;gap:22px;align-items:start;}' +
      '.hero img{width:100%;height:210px;object-fit:cover;border:1px solid #ddd;border-radius:8px;}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px;} td,th{padding:11px;border:1px solid #ddd;text-align:left;}' +
      'th{background:#f6f6f5;} .note{margin-top:24px;padding:14px;background:#f8f8f7;border:1px solid #ddd;border-radius:8px;}' +
      '.actions{margin-top:22px;} button{min-height:42px;padding:0 16px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;font-weight:800;cursor:pointer;}' +
      '@media print{body{background:#fff}.sheet{margin:0;border:0}.actions{display:none}}' +
      '@media(max-width:760px){.sheet{margin:0;padding:20px}.hero{grid-template-columns:1fr}header{display:block}.code{display:inline-block;margin-top:12px}}' +
      '</style></head><body><main class="sheet">' +
      '<header><div><p style="margin:0 0 6px;color:#666;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Aquaglass</p>' +
      '<h1>' + escapeHtml(product.name) + '</h1><p>Ficha técnica provisoria</p></div><div class="code">' + escapeHtml(product.code) + '</div></header>' +
      '<section class="hero"><img src="' + escapeAttribute(product.images[0]) + '" alt="' + escapeAttribute(product.name) + '">' +
      '<div><h2>Datos generales</h2><table><tbody>' +
      techRow("Línea", product.category) +
      techRow("Medida", measure) +
      techRow("Material", product.material) +
      techRow("Terminación", product.finish) +
      techRow("Precio ficticio", money(price)) +
      techRow("Fecha", date) +
      '</tbody></table></div></section>' +
      '<h2>Especificaciones de referencia</h2><table><tbody>' +
      techRow("Uso sugerido", "Residencial / obra") +
      techRow("Color base", "Blanco brillante") +
      techRow("Instalación", "A confirmar según proyecto") +
      techRow("Garantía", "Referencia comercial a definir") +
      techRow("Observaciones", "Ficha ficticia para armado de estructura interna") +
      '</tbody></table>' +
      '<p class="note">Documento de referencia. Las medidas, precios y condiciones técnicas finales deben confirmarse con el equipo comercial de Aquaglass.</p>' +
      '<div class="actions"><button type="button" onclick="window.print()">Imprimir / guardar PDF</button></div>' +
      '</main></body></html>';
  }

  function techRow(label, value) {
    return '<tr><th>' + escapeHtml(label) + '</th><td>' + escapeHtml(value || "-") + '</td></tr>';
  }

  function renderVariantSelector(product) {
    if (!hasVariants(product)) {
      els.variantField.hidden = true;
      els.variantSelect.innerHTML = "";
      return;
    }
    var selectedCode = state.selectedVariants[product.id] || "";
    els.variantField.hidden = false;
    els.variantSelect.innerHTML = '<option value="">Elegir medida</option>' + product.variants.map(function (variant) {
      return '<option value="' + escapeAttribute(variant.code) + '"' + (variant.code === selectedCode ? " selected" : "") + '>' +
        escapeHtml(variant.measure + " - " + money(variant.price)) +
        '</option>';
    }).join("");
    els.variantHelp.textContent = selectedCode
      ? "La medida elegida se va a guardar en el carrito."
      : "Seleccioná una medida para poder agregar esta bañera al carrito.";
  }

  function hasVariants(product) {
    return Boolean(product && product.variants && product.variants.length);
  }

  function selectedVariant(product) {
    if (!hasVariants(product)) {
      return null;
    }
    var selectedCode = state.selectedVariants[product.id] || "";
    return product.variants.find(function (variant) { return variant.code === selectedCode; }) || null;
  }

  function displayMeasureForProduct(product) {
    if (!hasVariants(product)) {
      return product.measure;
    }
    return product.variants.length + " medidas disponibles";
  }

  function displayPriceForProduct(product) {
    if (!hasVariants(product)) {
      return product.price;
    }
    return product.variants.reduce(function (lowest, variant) {
      return Math.min(lowest, Number(variant.price || 0));
    }, Number(product.variants[0].price || product.price || 0));
  }

  function displayPriceLabel(product) {
    if (!hasVariants(product)) {
      return money(product.price);
    }
    return "Desde " + money(displayPriceForProduct(product));
  }

  function addSelectedProduct() {
    var product = selectedProduct();
    if (!product) {
      return;
    }
    var variant = selectedVariant(product);
    if (hasVariants(product) && !variant) {
      alert("Seleccioná una medida antes de agregar la bañera al carrito.");
      return;
    }
    var quantity = Math.max(1, Math.floor(Number(els.quantity.value) || 1));
    var measure = variant ? variant.measure : product.measure;
    var unitPrice = variant ? variant.price : product.price;
    var variantCode = variant ? variant.code : "";
    var existing = state.items.find(function (item) {
      return item.productId === product.id && (item.variantCode || "") === variantCode;
    });
    if (existing) {
      existing.quantity += quantity;
      existing.subtotal = existing.quantity * existing.unitPrice;
      existing.image = existing.image || product.images[0];
    } else {
      state.items.push({
        id: String(Date.now()),
        productId: product.id,
        variantCode: variantCode,
        code: variant ? product.code + "-" + variant.code : product.code,
        name: product.name,
        category: product.category,
        measure: measure,
        image: product.images[0],
        unitPrice: unitPrice,
        quantity: quantity,
        note: "",
        subtotal: unitPrice * quantity
      });
    }
    els.quantity.value = "1";
    renderBudget();
    persist();
    updateCartBadge();
    showCartToast();
  }

  function renderBudget() {
    readProjectForm();
    els.budgetItems.innerHTML = "";
    els.itemCount.textContent = state.items.length + (state.items.length === 1 ? " ítem" : " ítems");

    if (!state.items.length) {
      els.budgetItems.innerHTML = '<p class="empty">Todavía no agregaste productos.</p>';
    } else {
      state.items.forEach(function (item) {
        item.image = item.image || productImageById(item.productId);
        item.note = item.note || "";
        var row = document.createElement("article");
        row.className = "budget-item";
        row.innerHTML =
          '<img class="budget-thumb" src="' + escapeAttribute(item.image) + '" alt="' + escapeAttribute(item.name) + '">' +
          '<div class="budget-item-body">' +
          '<header><div><h3>' + escapeHtml(item.name) + '</h3><small>' + escapeHtml(item.code) + '</small></div>' +
          '<button type="button" class="trash-button" data-action="remove" data-id="' + escapeAttribute(item.id) + '" aria-label="Borrar producto">' + trashIcon() + '</button></header>' +
          '<p>' + escapeHtml(item.category + " - " + item.measure + " - " + money(item.unitPrice) + " c/u") + '</p>' +
          '<div class="item-fields">' +
          '<label>Cantidad<input class="item-quantity" type="number" min="1" step="1" value="' + escapeAttribute(item.quantity) + '" data-action="quantity" data-id="' + escapeAttribute(item.id) + '"></label>' +
          '<strong data-line-total="' + escapeAttribute(item.id) + '">' + money(item.subtotal) + '</strong>' +
          '</div>' +
          '<label class="item-note">Requerimientos especiales<textarea rows="2" data-action="note" data-id="' + escapeAttribute(item.id) + '" placeholder="Ej: terminacion, medida especial, detalle de obra...">' + escapeHtml(item.note) + '</textarea></label>' +
          '</div>';
        els.budgetItems.appendChild(row);
      });
    }

    Array.prototype.forEach.call(els.budgetItems.querySelectorAll("button[data-action='remove']"), function (button) {
      button.addEventListener("click", function () {
        updateItem(button.dataset.id, "remove");
      });
    });
    Array.prototype.forEach.call(els.budgetItems.querySelectorAll("input[data-action='quantity']"), function (input) {
      input.addEventListener("input", function () {
        updateItem(input.dataset.id, "quantity", input.value);
      });
      input.addEventListener("change", function () {
        updateItem(input.dataset.id, "quantity", input.value);
      });
    });
    Array.prototype.forEach.call(els.budgetItems.querySelectorAll("textarea[data-action='note']"), function (textarea) {
      textarea.addEventListener("input", function () {
        updateItem(textarea.dataset.id, "note", textarea.value);
      });
    });

    updateTotalsDisplay();
    updateCartBadge();
  }

  function updateItem(id, action, value) {
    var item = state.items.find(function (entry) { return entry.id === id; });
    if (!item) {
      return;
    }
    if (action === "remove") {
      state.items = state.items.filter(function (entry) { return entry.id !== id; });
      renderBudget();
    }
    if (action === "quantity") {
      item.quantity = Math.max(1, Math.floor(Number(value) || 1));
      item.subtotal = item.quantity * item.unitPrice;
      updateLineSubtotal(item);
      updateTotalsDisplay();
      updateCartBadge();
    }
    if (action === "note") {
      item.note = value || "";
    }
    persist();
  }

  function updateTotalsDisplay() {
    var totals = calculateTotals();
    els.subtotal.textContent = money(totals.subtotal);
    els.discountAmount.textContent = "- " + money(totals.discount);
    els.vatAmount.textContent = money(totals.vat);
    els.total.textContent = money(totals.total);
  }

  function updateLineSubtotal(item) {
    var lineTotal = els.budgetItems.querySelector('[data-line-total="' + cssEscape(item.id) + '"]');
    if (lineTotal) {
      lineTotal.textContent = money(item.subtotal);
    }
  }

  function showCartToast() {
    els.cartToast.hidden = false;
    els.cartToast.classList.add("visible");
    window.clearTimeout(showCartToast.timer);
    showCartToast.timer = window.setTimeout(function () {
      els.cartToast.classList.remove("visible");
      window.setTimeout(function () {
        els.cartToast.hidden = true;
      }, 220);
    }, 1800);
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';
  }
  function calculateTotals() {
    var subtotal = state.items.reduce(function (sum, item) { return sum + Number(item.subtotal || 0); }, 0);
    var discountRate = clamp(Number(els.discount.value || 0), 0, 100) / 100;
    var discount = Math.round(subtotal * discountRate);
    var net = subtotal - discount;
    var vat = els.applyVat.checked ? Math.round(net * VAT_RATE) : 0;
    return {
      subtotal: subtotal,
      discount: discount,
      vat: vat,
      total: net + vat
    };
  }

  function printBudget() {
    readProjectForm();
    if (!state.items.length) {
      alert("Agregá al menos un producto para generar el PDF.");
      return;
    }
    els.printDocument.innerHTML = buildPrintHtml();
    setPrintDocumentTitle();
    window.print();
  }

  function setPrintDocumentTitle() {
    var originalTitle = document.title;
    document.title = buildPdfFilename();
    window.addEventListener("afterprint", function restoreTitle() {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    });
  }

  function buildPdfFilename() {
    return [
      "AquaGlass",
      filenamePart(state.project.clientName || "Cliente"),
      filenamePart(state.project.projectName || "Obra")
    ].join("_");
  }

  function buildPrintHtml() {
    var totals = calculateTotals();
    var rows = state.items.map(function (item) {
      item.image = item.image || productImageById(item.productId);
      return '<tr>' +
        '<td><img class="print-product-image" src="' + escapeAttribute(item.image) + '" alt=""></td>' +
        '<td><strong>' + escapeHtml(item.name) + '</strong><span class="print-code">' + escapeHtml(item.code) + '</span><br>' + escapeHtml(item.category + " - " + item.measure) + printItemNote(item.note) + '</td>' +
        '<td class="number">' + item.quantity + '</td>' +
        '<td class="number">' + money(item.unitPrice) + '</td>' +
        '<td class="number">' + money(item.subtotal) + '</td>' +
        '</tr>';
    }).join("");

    return '' +
      '<div class="print-page">' +
      '<div class="print-header">' +
      '<img class="print-logo" src="assets/logo.png" alt="Aquaglass">' +
      '<div class="print-title"><h1>Presupuesto Aquaglass</h1>' +
      '<p><strong>' + escapeHtml(state.quoteNumber) + '</strong></p>' +
      '<p>Fecha: ' + escapeHtml(new Date().toLocaleDateString("es-AR")) + '</p>' +
      '<p>Validez: ' + escapeHtml(state.project.validity || "15 días") + '</p></div>' +
      '</div>' +
      '<section class="print-section"><h2>Cliente / proyecto</h2><div class="print-grid">' +
      printField("Cliente / estudio", state.project.clientName) +
      printField("Obra / proyecto", state.project.projectName) +
      printField("Contacto", state.project.contactName) +
      printField("Email", state.project.email) +
      '</div></section>' +
      '<section class="print-section"><h2>Productos seleccionados</h2><table class="print-table"><thead><tr>' +
      '<th>Imagen</th><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></section>' +
      '<section class="print-section print-bottom"><div>' +
      '<h2>Observaciones</h2><p class="print-text">' + escapeHtml(state.project.observations || "Sin observaciones.") + '</p>' +
      '<h2>Condiciones comerciales</h2><p class="print-text">Precios ficticios de referencia expresados en dólares americanos (USD). No incluyen instalación, flete ni trabajos de obra civil salvo indicación expresa. Presupuesto sujeto a revisión comercial final.</p>' +
      '</div><div class="print-totals">' +
      '<div><span>Subtotal</span><strong>' + money(totals.subtotal) + '</strong></div>' +
      '<div><span>Descuento</span><strong>- ' + money(totals.discount) + '</strong></div>' +
      '<div><span>IVA</span><strong>' + money(totals.vat) + '</strong></div>' +
      '<div class="final"><span>Total</span><strong>' + money(totals.total) + '</strong></div>' +
      '</div></section>' +
      '<footer class="print-footer">Aquaglass · Catálogo comercial con imágenes reales · Valores expresados en dólares americanos (USD) · ' + escapeHtml(state.quoteNumber) + '</footer>' +
      '</div>';
  }

  function printField(label, value) {
    return '<div><span>' + escapeHtml(label) + '</span>' + escapeHtml(value || "-") + '</div>';
  }

  function printItemNote(note) {
    if (!note) {
      return "";
    }
    return '<br><em class="print-note">Requerimientos: ' + escapeHtml(note) + '</em>';
  }

  function exportJson() {
    readProjectForm();
    var payload = {
      quoteNumber: state.quoteNumber,
      currency: "USD",
      date: new Date().toISOString(),
      project: state.project,
      items: state.items,
      totals: calculateTotals()
    };
    downloadFile("presupuesto-aquaglass-" + state.quoteNumber + ".json", "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
  }

  function clearBudget() {
    if (state.items.length && !window.confirm("¿Limpiar el presupuesto actual?")) {
      return;
    }
    state.items = [];
    state.quoteNumber = createQuoteNumber();
    els.quoteNumber.textContent = state.quoteNumber;
    renderBudget();
    persist();
  }

  function categories() {
    var set = ["Todos"];
    state.catalog.products.forEach(function (product) {
      if (set.indexOf(product.category) === -1) {
        set.push(product.category);
      }
    });
    return set;
  }

  function filteredProducts() {
    var query = normalize(state.query);
    return state.catalog.products.filter(function (product) {
      var inCategory = state.activeCategory === "Todos" || product.category === state.activeCategory;
      var variantText = hasVariants(product)
        ? product.variants.map(function (variant) { return [variant.code, variant.measure].join(" "); }).join(" ")
        : "";
      var haystack = normalize([product.name, product.category, product.measure, product.code, product.material, variantText].join(" "));
      return inCategory && (!query || haystack.indexOf(query) !== -1);
    });
  }

  function firstProductId() {
    return state.catalog.products[0] ? state.catalog.products[0].id : "";
  }

  function selectedProduct() {
    return findProduct(state.selectedProductId);
  }

  function findProduct(id) {
    return state.catalog.products.find(function (product) { return product.id === id; });
  }

  function productImageById(id) {
    var product = findProduct(id);
    return product && product.images && product.images[0] ? product.images[0] : "assets/placeholder-product.jpg";
  }

  function loadSaved() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        state.items = normalizeSavedItems(saved.items || []);
        state.project = saved.project || {};
        state.quoteNumber = saved.quoteNumber || createQuoteNumber();
        state.activeCategory = saved.activeCategory || "Todos";
        state.query = saved.query || "";
        state.selectedProductId = saved.selectedProductId || "";
        state.selectedVariants = saved.selectedVariants || {};
      }
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (!state.quoteNumber) {
      state.quoteNumber = createQuoteNumber();
    }
  }

  function migrateOldSavedItems() {
    if (localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    var old = localStorage.getItem("aquaglass_catalog_budget_v2");
    if (old) {
      localStorage.setItem(STORAGE_KEY, old);
    }
  }

  function normalizeSavedItems(items) {
    return items.map(function (item) {
      item.image = item.image || productImageById(item.productId);
      item.note = item.note || "";
      item.variantCode = item.variantCode || "";
      item.subtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return item;
    });
  }

  function persist() {
    readProjectForm();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items: state.items,
      project: state.project,
      quoteNumber: state.quoteNumber,
      activeCategory: state.activeCategory,
      query: state.query,
      selectedProductId: state.selectedProductId,
      selectedVariants: state.selectedVariants
    }));
  }

  function hydrateProjectForm() {
    els.searchInput.value = state.query || "";
    els.clientName.value = state.project.clientName || "";
    els.projectName.value = state.project.projectName || "";
    els.contactName.value = state.project.contactName || "";
    els.email.value = state.project.email || "";
    els.validity.value = state.project.validity || "15 días";
    els.discount.value = state.project.discount || 0;
    els.applyVat.checked = Boolean(state.project.applyVat);
    els.observations.value = state.project.observations || "";
  }

  function readProjectForm() {
    state.project = {
      clientName: els.clientName.value.trim(),
      projectName: els.projectName.value.trim(),
      contactName: els.contactName.value.trim(),
      email: els.email.value.trim(),
      validity: els.validity.value.trim(),
      discount: clamp(Number(els.discount.value || 0), 0, 100),
      applyVat: els.applyVat.checked,
      observations: els.observations.value.trim()
    };
  }

  function projectInputs() {
    return [els.clientName, els.projectName, els.contactName, els.email, els.validity, els.discount, els.applyVat, els.observations];
  }

  function money(value) {
    return "$ " + Number(value || 0).toLocaleString("es-AR", {
      maximumFractionDigits: 0
    });
  }

  function createQuoteNumber() {
    var now = new Date();
    return "AQ-" + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + String(now.getTime()).slice(-4);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function clamp(value, min, max) {
    if (!isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function slugify(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "producto";
  }

  function filenamePart(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/_+/g, "-") || "Sin-dato";
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  function downloadFile(filename, mimeType, content) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
}());
